import { describe, expect, it } from 'vitest';
import { sanitizeSvg, selectLogo, snapshot } from '../src/index';

describe('user gets safe logos from the same canonical identity', () => {
  it('user sees an explicit model, family, developer or default logo in that order', () => {
    // Given one real model and a fully registered set of logo candidates.
    const model = {
      ...Object.values(snapshot.data.models)[0],
      id: 'example',
      familyId: 'family',
      developerId: 'lab',
    };
    // When different explicit mapping levels are available.
    const all = {
      models: { example: 'model' },
      families: { family: 'family' },
      developers: { lab: 'developer' },
    };
    // Then each fallback is deterministic without guessing from a display name.
    expect(selectLogo(model, all)).toEqual({ key: 'model', level: 'model' });
    expect(selectLogo(model, { ...all, models: {} })).toEqual({
      key: 'family',
      level: 'family',
    });
    expect(selectLogo(model, { ...all, models: {}, families: {} })).toEqual({
      key: 'developer',
      level: 'developer',
    });
    expect(
      selectLogo(model, { models: {}, families: {}, developers: {} }),
    ).toEqual({ key: null, level: 'default' });
  });
  it('user cannot receive scripts, event handlers or remote SVG resources', () => {
    // Given independently displayed SVG resources and hostile candidate markup.
    // When SVG safety validation runs before build output.
    const safe =
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M0 0"/></svg>';
    // Then scripts and resources are refused, while monochrome color becomes fixed.
    expect(sanitizeSvg(safe)).toContain('#111827');
    for (const input of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="x"/>',
      '<svg><use href="https://example.org/a"/></svg>',
      '<svg><path fill="url(https://example.org/a)"/></svg>',
    ])
      expect(() => sanitizeSvg(input)).toThrow();
  });
});
