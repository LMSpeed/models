import {
  loadCompatibleSnapshot,
  type Model,
  type Resolution,
  resolveModelId,
  type Snapshot,
} from '../../../packages/core/src/index';

export type {
  Model,
  Resolution,
  Snapshot,
} from '../../../packages/core/src/index';
export const SDK_VERSION = '0.1.0';
export type ErrorCode =
  | 'not_found'
  | 'ambiguous'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'invalid_json'
  | 'invalid_contract'
  | 'schema_incompatible'
  | 'not_loaded'
  | 'revision_mismatch';
export class ModelsError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly candidates: string[] = [],
  ) {
    super(message);
    this.name = 'ModelsError';
  }
}
export type Filter = {
  task?: string;
  input?: string;
  output?: string;
  developerId?: string;
};
export type LogoInfo = {
  modelId: string;
  key: string | null;
  level: string;
  fallback: boolean;
  source: string;
  version: string;
  sha256: string;
};
export type LogoIndex = {
  schemaVersion: number;
  revision: number;
  models: Record<string, LogoInfo>;
};
export class Catalog {
  private logos?: LogoIndex;
  private constructor(
    public readonly snapshot: Snapshot,
    public readonly baseUrl = 'https://models.lmspeed.net',
  ) {}
  static async fromJson(
    input: unknown,
    baseUrl = 'https://models.lmspeed.net',
  ): Promise<Catalog> {
    let raw: unknown = input;
    if (typeof input === 'string') {
      try {
        raw = JSON.parse(input);
      } catch {
        throw new ModelsError('invalid_json', 'Catalogue is not valid JSON');
      }
    }
    if (
      typeof raw === 'object' &&
      raw !== null &&
      'schemaVersion' in raw &&
      raw.schemaVersion !== 1
    )
      throw new ModelsError(
        'schema_incompatible',
        'Unsupported schema major version',
      );
    try {
      return new Catalog(
        await loadCompatibleSnapshot(raw),
        baseUrl.replace(/\/+$/, ''),
      );
    } catch (error) {
      throw new ModelsError(
        'invalid_contract',
        `Invalid model catalogue: ${String(error)}`,
      );
    }
  }
  get revision() {
    return this.snapshot.revision;
  }
  get dataUpdatedAt() {
    return this.snapshot.dataUpdatedAt;
  }
  get models() {
    return this.snapshot.data.models;
  }
  resolveModelId(value: string, namespace?: string): Resolution {
    return resolveModelId(this.snapshot.data, value, namespace);
  }
  get(value: string, namespace?: string): Model {
    const resolution = this.resolveModelId(value, namespace);
    if (resolution.status !== 'resolved')
      throw new ModelsError(
        resolution.status,
        `${resolution.status}: ${value}`,
        resolution.candidates,
      );
    return this.models[resolution.canonicalId];
  }
  filter(filter: Filter): Model[] {
    return Object.values(this.models).filter(
      (model) =>
        (!filter.task || model.tasks.includes(filter.task)) &&
        (!filter.input || model.modalities.input?.includes(filter.input)) &&
        (!filter.output || model.modalities.output?.includes(filter.output)) &&
        (!filter.developerId || model.developerId === filter.developerId),
    );
  }
  iconUrl(value: string, namespace?: string): string {
    return `${this.baseUrl}/v1/models/${encodeURIComponent(this.get(value, namespace).id)}.svg`;
  }
  sources(value: string, field?: string, namespace?: string) {
    const sources = this.get(value, namespace).sources;
    return field
      ? sources.filter((source) =>
          source.fields.some(
            (path) => path === field || field.startsWith(`${path}/`),
          ),
        )
      : sources;
  }
  upstreamFacts(value: string, namespace?: string) {
    return this.get(value, namespace).upstreamFacts?.modelsDev ?? [];
  }
  attachLogos(logos: LogoIndex): void {
    if (logos.schemaVersion !== 1)
      throw new ModelsError('schema_incompatible', 'Unsupported logo schema');
    if (logos.revision !== this.revision)
      throw new ModelsError(
        'revision_mismatch',
        'Logo metadata belongs to another data revision',
      );
    this.logos = logos;
  }
  iconInfo(value: string, namespace?: string): LogoInfo {
    if (!this.logos)
      throw new ModelsError(
        'not_loaded',
        'Load logo metadata before reading its source',
      );
    const id = this.get(value, namespace).id;
    const info = this.logos.models[id];
    if (!info)
      throw new ModelsError('invalid_contract', `Missing logo metadata: ${id}`);
    return info;
  }
}
export type ClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  conditionalRequests?: boolean;
};
export class Client {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly conditionalRequests: boolean;
  private etag?: string;
  private catalogue?: Catalog;
  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://models.lmspeed.net').replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? 30000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0)
      throw new RangeError('timeoutMs must be positive');
    this.conditionalRequests =
      options.conditionalRequests ?? typeof window === 'undefined';
  }
  get current() {
    return this.catalogue;
  }
  private async request(
    path: string,
    signal?: AbortSignal,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers,
        signal: AbortSignal.any([
          AbortSignal.timeout(this.timeoutMs),
          ...(signal ? [signal] : []),
        ]),
      });
      if (response.status === 304) return response;
      if (!response.ok)
        throw new ModelsError(
          response.status === 404 ? 'not_found' : 'network',
          `HTTP ${response.status}`,
        );
      return response;
    } catch (error) {
      if (error instanceof ModelsError) throw error;
      if (signal?.aborted)
        throw new ModelsError('cancelled', 'Request cancelled');
      if (
        error instanceof Error &&
        ['AbortError', 'TimeoutError'].includes(error.name)
      )
        throw new ModelsError('timeout', 'Request timed out');
      throw new ModelsError('network', String(error));
    }
  }
  async refresh(signal?: AbortSignal): Promise<Catalog> {
    const response = await this.request(
      '/v1/api.json',
      signal,
      this.etag && this.conditionalRequests
        ? { 'if-none-match': this.etag }
        : {},
    );
    if (response.status === 304) {
      if (!this.catalogue)
        throw new ModelsError(
          'invalid_contract',
          '304 without a loaded catalogue',
        );
      return this.catalogue;
    }
    const candidate = await Catalog.fromJson(
      await response.text(),
      this.baseUrl,
    );
    this.catalogue = candidate;
    this.etag = response.headers.get('etag') ?? undefined;
    return candidate;
  }
  async get(
    value: string,
    namespace?: string,
    signal?: AbortSignal,
  ): Promise<Model> {
    return (this.catalogue ?? (await this.refresh(signal))).get(
      value,
      namespace,
    );
  }
  async logos(signal?: AbortSignal): Promise<LogoIndex> {
    const catalog = this.catalogue ?? (await this.refresh(signal));
    const response = await this.request('/logos.json', signal);
    let logos: LogoIndex;
    try {
      logos = (await response.json()) as LogoIndex;
    } catch {
      throw new ModelsError('invalid_json', 'Logo metadata is not valid JSON');
    }
    catalog.attachLogos(logos);
    return logos;
  }
  async coverage(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.request('/coverage/models-dev.json', signal);
    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new ModelsError(
        'invalid_json',
        'Coverage report is not valid JSON',
      );
    }
    if (this.catalogue && data.revision !== this.catalogue.revision)
      throw new ModelsError(
        'revision_mismatch',
        'Coverage belongs to another data revision',
      );
    return data;
  }
}
