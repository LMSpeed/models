import { z } from 'zod';

export const SCHEMA_VERSION = 1;
export const SCOPE = 'published-model-specs/all-types';
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);
const id = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const date = z.string().regex(/^\d{4}(-\d{2}(-\d{2}(T.*Z)?)?)?$/);
const unknownNumber = z.number().finite().nonnegative().nullable().optional();
const unknownBoolean = z.boolean().nullable();
export const sourceSchema = z.strictObject({
  url: z.url(),
  fields: z.array(z.string().startsWith('/')),
  scope: z.literal('model'),
  checkedAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z)?$/,
    )
    .describe(
      'Verification date or UTC timestamp, preserving source precision. observedAt records acquisition separately.',
    )
    .optional(),
  observedAt: z.iso.datetime().optional(),
  repository: z.url().optional(),
  commit: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .optional(),
  path: z.string().optional(),
  sourceField: z.string().optional(),
  license: z.string().optional(),
});
const link = z.strictObject({
  url: z.url(),
  label: z.string().optional(),
  type: z.string().optional(),
});
const weight = z.strictObject({
  url: z.url(),
  label: z.string().optional(),
  format: z.string().optional(),
  quantization: z.string().optional(),
});
export const modelSchema = z.strictObject({
  id,
  name: z.string().min(1),
  developerId: id,
  familyId: id.optional(),
  description: z.string().optional(),
  releaseDate: date.nullable().optional(),
  lastUpdated: date.nullable().optional(),
  lifecycle: z
    .enum(['alpha', 'beta', 'active', 'deprecated', 'retired'])
    .nullable()
    .optional(),
  externalIds: z.record(z.string(), z.array(z.string())).optional(),
  tasks: z.array(z.string()),
  modalities: z.strictObject({
    input: z.array(z.string()).nullable(),
    output: z.array(z.string()).nullable(),
  }),
  fileFormats: z
    .strictObject({
      input: z.array(z.string()).nullable(),
      output: z.array(z.string()).nullable(),
    })
    .optional(),
  parameters: z
    .strictObject({
      totalBillions: unknownNumber,
      activeBillions: unknownNumber,
    })
    .optional(),
  architecture: z.string().nullable().optional(),
  knowledgeCutoff: date.nullable().optional(),
  languages: z.array(z.string()).nullable().optional(),
  openWeights: unknownBoolean.optional(),
  modelLicense: z.string().nullable().optional(),
  links: z.array(link).optional(),
  weights: z.array(weight).optional(),
  specs: z.strictObject({
    text: z
      .strictObject({
        contextWindowTokens: unknownNumber,
        maxInputTokens: unknownNumber,
        maxOutputTokens: unknownNumber,
        tokenizer: z.string().nullable().optional(),
      })
      .optional(),
    image: z
      .strictObject({
        generation: unknownBoolean.optional(),
        editing: unknownBoolean.optional(),
        multiReference: unknownBoolean.optional(),
        documentedSizes: z
          .array(
            z.strictObject({
              widthPixels: z.number().int().positive(),
              heightPixels: z.number().int().positive(),
            }),
          )
          .nullable()
          .optional()
          .describe(
            'Sizes demonstrated in official inference examples; not a declaration of an exhaustive set or a maximum.',
          ),
        maxPerMessage: unknownNumber,
        maxPerRequest: unknownNumber,
        maxBytes: unknownNumber,
        minWidthPixels: unknownNumber,
        minHeightPixels: unknownNumber,
        maxWidthPixels: unknownNumber,
        maxHeightPixels: unknownNumber,
        maxPixels: unknownNumber,
        maxReferenceImages: unknownNumber,
        aspectRatios: z.array(z.string()).nullable().optional(),
        sizes: z
          .array(
            z.strictObject({
              widthPixels: z.number().nonnegative(),
              heightPixels: z.number().nonnegative(),
            }),
          )
          .nullable()
          .optional(),
      })
      .optional(),
    video: z
      .strictObject({
        durationSeconds: unknownNumber,
        framesPerSecond: unknownNumber,
        maxWidthPixels: unknownNumber,
        maxHeightPixels: unknownNumber,
      })
      .optional(),
    audio: z
      .strictObject({
        sampleRateHz: unknownNumber,
        channels: unknownNumber,
        durationSeconds: unknownNumber,
      })
      .optional(),
    embedding: z
      .strictObject({
        dimensions: z
          .array(z.number().int().nonnegative())
          .nullable()
          .optional(),
        maxInputTokens: unknownNumber,
      })
      .optional(),
    document: z
      .strictObject({
        maxPerRequest: unknownNumber,
        maxBytes: unknownNumber,
        maxPages: unknownNumber,
      })
      .optional(),
    request: z.strictObject({ maxBytes: unknownNumber }).optional(),
  }),
  capabilities: z.strictObject({
    reasoning: unknownBoolean,
    toolCalling: unknownBoolean,
    temperature: unknownBoolean.optional(),
    topP: unknownBoolean.optional(),
    topK: unknownBoolean.optional(),
    tools: z
      .strictObject({
        strict: z.boolean().optional(),
        choice: z.array(z.string()).optional(),
        search: z.boolean().optional(),
        freeform: z.array(z.string()).optional(),
        updates: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  sources: z.array(sourceSchema),
  upstreamFacts: z
    .strictObject({
      modelsDev: z.array(
        z.strictObject({
          field: z.string(),
          sourceField: z.string(),
          value: jsonValue,
          source: sourceSchema,
          conflict: z.boolean(),
          resolution: z.enum(['pending', 'verified']).optional(),
        }),
      ),
    })
    .optional(),
});
export type Model = z.infer<typeof modelSchema>;
export const developerSchema = z.strictObject({
  id,
  name: z.string().min(1),
  website: z.url().nullable(),
});
const aliasSource = z.strictObject({
  url: z.url(),
  commit: z.string().optional(),
  path: z.string().optional(),
});
export const aliasSchema = z.strictObject({
  namespace: z.string().min(1),
  value: z.string().min(1).max(512),
  canonicalId: id,
  routeKey: z.string().min(1).max(768),
  kind: z.enum(['fixed', 'moving']),
  source: aliasSource,
  revision: z.number().int().positive().optional(),
  history: z
    .array(
      z.strictObject({
        revision: z.number().int().positive(),
        canonicalId: id,
      }),
    )
    .optional(),
});
export type Alias = z.infer<typeof aliasSchema>;
export const aliasIndexSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  namespaces: z.record(
    z.string(),
    z.strictObject({ caseSensitive: z.boolean() }),
  ),
  models: z.array(aliasSchema),
  developers: z.array(aliasSchema),
  families: z.array(aliasSchema),
});
export const upstreamSchema = z.strictObject({
  id: z.string(),
  repository: z.url(),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  license: z.string(),
  observedAt: z.iso.datetime(),
  modelCount: z.number().int().nonnegative(),
  latestCheckedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  lastCheckedAt: z.iso.datetime(),
});
export const dataSchema = z.strictObject({
  models: z.record(id, modelSchema),
  developers: z.record(id, developerSchema),
  aliases: aliasIndexSchema,
  redirects: z.array(
    z.strictObject({
      from: id,
      to: id.nullable(),
      kind: z.enum(['rename', 'merge', 'withdrawal']),
      revision: z.number().int().positive(),
      reason: z.string(),
    }),
  ),
  upstreams: z.array(upstreamSchema),
});
export type Data = z.infer<typeof dataSchema>;
export const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  scope: z.literal(SCOPE),
  revision: z.number().int().positive(),
  dataUpdatedAt: z.iso.datetime(),
  counts: z.strictObject({
    models: z.number().int().nonnegative(),
    developers: z.number().int().nonnegative(),
  }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  data: dataSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Resolution =
  | {
      status: 'resolved';
      canonicalId: string;
      namespace: string;
      alias?: Alias;
    }
  | { status: 'ambiguous' | 'not_found'; candidates: string[] };

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const result = JSON.stringify(value);
    if (
      result === undefined ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new Error('Non-JSON value');
    return result;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}
export async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(value)),
  );
  return [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export function normalizeAlias(value: string, caseSensitive: boolean): string {
  // ASCII folding is deliberately shared with all SDKs, independent of locale.
  const trimmed = value.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '');
  return caseSensitive
    ? trimmed
    : trimmed.replace(/[A-Z]/g, (c) => c.toLowerCase());
}
export function resolveModelId(
  data: Pick<Data, 'models' | 'aliases'>,
  value: string,
  namespace?: string,
): Resolution {
  const input = normalizeAlias(value, true);
  if (!namespace && Object.hasOwn(data.models, input))
    return { status: 'resolved', canonicalId: input, namespace: 'canonical' };
  const match = (alias: Alias) =>
    alias.namespace === (namespace ?? alias.namespace) &&
    normalizeAlias(
      alias.value,
      data.aliases.namespaces[alias.namespace]?.caseSensitive ?? true,
    ) ===
      normalizeAlias(
        input,
        data.aliases.namespaces[alias.namespace]?.caseSensitive ?? true,
      );
  const all = data.aliases.models.filter(match);
  const globals = namespace ? [] : all.filter((a) => a.namespace === 'global');
  const matches = globals.length ? globals : all;
  const candidates = [...new Set(matches.map((a) => a.canonicalId))].sort();
  if (candidates.length !== 1)
    return {
      status: candidates.length ? 'ambiguous' : 'not_found',
      candidates,
    };
  const alias = [...matches].sort((a, b) =>
    a.namespace.localeCompare(b.namespace, 'en'),
  )[0];
  return {
    status: 'resolved',
    canonicalId: candidates[0],
    namespace: alias.namespace,
    alias,
  };
}
export function routeManifest(data: Data): Map<string, string> {
  const routes = new Map(Object.keys(data.models).map((key) => [key, key]));
  for (const alias of data.aliases.models) {
    if (
      !/^[A-Za-z0-9._/-]+$/.test(alias.routeKey) ||
      alias.routeKey.split('/').some((p) => !p || p === '.' || p === '..')
    )
      throw new Error(`Unsafe routeKey: ${alias.routeKey}`);
    if (
      alias.namespace !== 'global' &&
      !alias.routeKey.startsWith(`${alias.namespace}/`)
    )
      throw new Error('External route requires namespace');
    const prior = routes.get(alias.routeKey);
    if (prior && prior !== alias.canonicalId)
      throw new Error(`Route conflict: ${alias.routeKey}`);
    routes.set(alias.routeKey, alias.canonicalId);
  }
  return routes;
}
export function validateData(input: unknown): Data {
  const data = dataSchema.parse(input);
  for (const [key, model] of Object.entries(data.models)) {
    if (key !== model.id || !Object.hasOwn(data.developers, model.developerId))
      throw new Error(`Invalid model identity: ${key}`);
  }
  for (const [key, developer] of Object.entries(data.developers))
    if (key !== developer.id) throw new Error('Invalid developer identity');
  const seen = new Map<string, string>();
  for (const alias of data.aliases.models) {
    if (
      !Object.hasOwn(data.models, alias.canonicalId) ||
      !Object.hasOwn(data.aliases.namespaces, alias.namespace)
    )
      throw new Error('Invalid alias target or namespace');
    if (alias.kind === 'moving' && !alias.revision)
      throw new Error('Moving alias requires revision');
    const key = canonicalJson([
      alias.namespace,
      normalizeAlias(
        alias.value,
        data.aliases.namespaces[alias.namespace].caseSensitive,
      ),
    ]);
    const previous = seen.get(key);
    if (previous && previous !== alias.canonicalId)
      throw new Error(`Alias conflict: ${key}`);
    seen.set(key, alias.canonicalId);
  }
  for (const redirect of data.redirects)
    if (redirect.to && !Object.hasOwn(data.models, redirect.to))
      throw new Error('Redirect target must be canonical');
  routeManifest(data);
  return data;
}
export async function validateSnapshot(input: unknown): Promise<Snapshot> {
  const snapshot = snapshotSchema.parse(input);
  validateData(snapshot.data);
  if (
    snapshot.counts.models !== Object.keys(snapshot.data.models).length ||
    snapshot.counts.developers !== Object.keys(snapshot.data.developers).length
  )
    throw new Error('Snapshot count mismatch');
  if (snapshot.data.aliases.revision !== snapshot.revision)
    throw new Error('Alias revision mismatch');
  if ((await sha256(snapshot.data)) !== snapshot.sha256)
    throw new Error('Snapshot hash mismatch');
  return snapshot;
}
export async function createSnapshot(
  data: Data,
  revision: number,
  dataUpdatedAt: string,
): Promise<Snapshot> {
  const next = structuredClone(data);
  next.aliases.revision = revision;
  return validateSnapshot({
    schemaVersion: 1,
    scope: SCOPE,
    revision,
    dataUpdatedAt,
    counts: {
      models: Object.keys(next.models).length,
      developers: Object.keys(next.developers).length,
    },
    sha256: await sha256(next),
    data: next,
  });
}
export function schemaDocument(): Record<string, unknown> {
  return z.toJSONSchema(snapshotSchema) as Record<string, unknown>;
}

export async function loadCompatibleSnapshot(
  input: unknown,
): Promise<Snapshot> {
  const known = structuredClone(input);
  let parsed = snapshotSchema.safeParse(known);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.code !== 'unrecognized_keys') throw parsed.error;
      let target: unknown = known;
      for (const part of issue.path) {
        if (target === null || typeof target !== 'object') throw parsed.error;
        target = (target as Record<PropertyKey, unknown>)[part];
      }
      if (target === null || typeof target !== 'object') throw parsed.error;
      for (const key of issue.keys)
        delete (target as Record<string, unknown>)[key];
    }
    parsed = snapshotSchema.safeParse(known);
  }
  if (!parsed.success) throw parsed.error;
  const raw = input as Snapshot;
  if ((await sha256(raw.data)) !== raw.sha256)
    throw new Error('Snapshot hash mismatch');
  await validateSnapshot({
    ...parsed.data,
    sha256: await sha256(parsed.data.data),
  });
  return raw;
}
