import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateData } from '../src/index';

describe('user can distinguish documented image sizes from hard model limits', () => {
  it('user retains a working official example without inventing a pixel ceiling', async () => {
    // Given a real documented inference size and unknown model limits.
    const fixture = JSON.parse(
      await readFile(
        new URL('../../../fixtures/contracts/valid.json', import.meta.url),
        'utf8',
      ),
    );
    fixture.data.models['fixture-image'].specs.image = {
      generation: true,
      editing: true,
      multiReference: true,
      documentedSizes: [{ widthPixels: 1024, heightPixels: 1024 }],
      maxPixels: null,
      maxReferenceImages: null,
    };
    fixture.data.models['fixture-image'].sources = [
      {
        url: 'https://example.org/official-inference',
        fields: ['/specs/image/documentedSizes'],
        scope: 'model',
        checkedAt: '2026-11-22',
      },
    ];
    // When an exporter validates the public image specification.
    const data = validateData(fixture.data);
    // Then an example size stays distinct from an unknown hard maximum.
    expect(data.models['fixture-image'].specs.image?.documentedSizes).toEqual([
      { widthPixels: 1024, heightPixels: 1024 },
    ]);
    expect(data.models['fixture-image'].specs.image?.maxPixels).toBeNull();
    expect(data.models['fixture-image'].sources[0].checkedAt).toBe(
      '2026-11-22',
    );
  });
});
