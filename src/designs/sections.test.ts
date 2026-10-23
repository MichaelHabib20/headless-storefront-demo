import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { bannerLayouts, sectionDesigns } from '@/components/home/sections/BannerLayouts';

/**
 * src/designs/sections.json is the storefront's design list: the backend stores it
 * (POST /api/storefront-designs/register, scripts/register-designs.mjs) and the admin lets the
 * merchant pick from it. Rules: section-designs contract §1.
 */
const file = path.join(__dirname, 'sections.json');
const list = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  version: number;
  designs: { key: string; needs: { banners_min: number; banners_max: number } }[];
};

const schema = {
  type: 'object',
  required: ['version', 'designs'],
  additionalProperties: false,
  properties: {
    version: { type: 'integer', minimum: 1 },
    designs: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['key', 'name_en', 'name_ar', 'needs', 'legacy_image_type'],
        additionalProperties: false,
        properties: {
          key: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
          name_en: { type: 'string', minLength: 1 },
          name_ar: { type: 'string', minLength: 1 },
          needs: {
            type: 'object',
            required: ['products', 'banners_min', 'banners_max'],
            additionalProperties: false,
            properties: {
              products: { type: 'boolean' },
              banners_min: { type: 'integer', minimum: 0 },
              banners_max: { type: 'integer', minimum: 0 },
            },
          },
          legacy_image_type: { type: ['integer', 'null'], minimum: 1, maximum: 9 },
        },
      },
    },
  },
};

describe('src/designs/sections.json', () => {
  it('matches the design-list format', () => {
    const validate = new Ajv({ allErrors: true }).compile(schema);
    expect(validate(list), JSON.stringify(validate.errors)).toBe(true);
  });

  it('has unique keys and sane banner counts', () => {
    const keys = list.designs.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const { key, needs } of list.designs) {
      expect(needs.banners_min, key).toBeLessThanOrEqual(needs.banners_max);
    }
  });

  it('starts with the six layout names, so every layout is also a design', () => {
    const first = ['products_only', 'single_banner', 'banner_carousel', 'wide_banner', 'banner_grid', 'banner_rows'];
    expect(list.designs.slice(0, 6).map((d) => d.key)).toEqual(first);
    expect([...first].sort()).toEqual(Object.keys(bannerLayouts).sort());
  });

  it('every design has a renderer', () => {
    for (const { key } of list.designs) {
      expect(sectionDesigns[key], `no renderer for design "${key}" in sectionDesigns (BannerLayouts.tsx)`).toBeTypeOf('function');
    }
  });
});
