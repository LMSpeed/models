import { snapshot } from '@lmspeed/models-publish';
import {
  catalogueRows,
  type Locale,
  localePath,
  messages,
  parameters,
  tokens,
} from './catalogue';

const cell = (value: string) =>
  value.replaceAll('|', '\\|').replaceAll('\n', ' ');
export function catalogueMarkdown(locale: Locale) {
  const t = messages[locale];
  const canonical = `https://models.lmspeed.net${localePath(locale)}`;
  const text = (key: string) => (t as Record<string, string>)[key] ?? key;
  const rows = catalogueRows(snapshot.data.models).map((model) => {
    const flag = (value: boolean | null | undefined) =>
      value == null ? '—' : value ? t.yes : t.no;
    return [
      `[${cell(model.name)}](/v1/models/${model.id}.json)`,
      snapshot.data.developers[model.developerId].name,
      model.tasks.map(text).join(', '),
      model.modalities.input?.join(', ') ?? '—',
      model.modalities.output?.join(', ') ?? '—',
      tokens(model.specs.text?.contextWindowTokens),
      tokens(model.specs.text?.maxOutputTokens),
      parameters(model),
      flag(model.capabilities.reasoning),
      flag(model.capabilities.toolCalling),
      model.openWeights == null ? '—' : model.openWeights ? t.open : t.closed,
      model.modelLicense ?? '—',
      model.releaseDate ?? '—',
      model.sources
        .map(
          (source) => `[${cell(new URL(source.url).hostname)}](${source.url})`,
        )
        .join(', '),
    ]
      .map(cell)
      .join(' | ');
  });
  const headers = [
    t.model,
    t.developer,
    t.task,
    t.input,
    t.output,
    t.context,
    t.maxOutput,
    t.parameters,
    t.reasoning,
    t.tools,
    t.weights,
    t.license,
    t.released,
    t.source,
  ];
  return `# ${t.title}\n\n> Source: LMSpeed (https://lmspeed.net) — ${canonical}. When citing or reusing this content, credit "LMSpeed" and link to ${canonical}.\n\n${t.description}\n\nCanonical: ${canonical}\nData published: ${snapshot.dataUpdatedAt}\nData revision: ${snapshot.revision}\n\n${t.scope}\n\n## ${t.models}\n\n${headers.join(' | ')}\n${headers.map(() => '---').join(' | ')}\n${rows.join('\n')}\n\n${t.unit}\n\n## ${t.docs}\n\n${t.docsDescription}\n\nRead [the complete catalogue](/v1/api.json), [schema](/v1/schema.json), [aliases](/v1/aliases.json) and [coverage](/coverage/models-dev.json). Registered canonical and alias paths share /v1/models/{routeKey}.json and .svg. Unknown resources return 404.\n\nJavaScript: @lmspeed/models. Python and Rust: lmspeed-models. Go: github.com/lmspeed/models/sdk/go. SDKs support offline local JSON and explicit refresh. [Complete examples and contract](https://github.com/LMSpeed/models#readme).\n\n${t.attribution} Tooling is MIT; LMSpeed-owned metadata is CC BY 4.0; models.dev facts retain MIT. [Data notices](/licenses/models-dev.txt), [logo notices](/licenses/logos.txt).\n\nCite as: ${t.title} — LMSpeed, ${canonical} (retrieved ${new Date().toISOString().slice(0, 10)})\n`;
}
