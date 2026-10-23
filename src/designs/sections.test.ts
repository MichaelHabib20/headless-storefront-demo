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
  designs: {
    key: string;
    needs: { banners_min: number; banners_max: number };
    legacy_image_type_by_banners?: Record<string, number>;
  }[];
};

/** The backend's limits for the register body (section-designs contract §1/§2): keep them identical. */
const imageType = { type: 'integer', minimum: 1, maximum: 9 };
const bannerCount = { type: 'integer', minimum: 0, maximum: 50 };
const name = { type: 'string', minLength: 1, maxLength: 255 };
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
        required: ['key', 'name_en', 'name_ar', 'needs'],
        additionalProperties: false,
        properties: {
          key: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
          name_en: name,
          name_ar: name,
          needs: {
            type: 'object',
            required: ['products', 'banners_min', 'banners_max'],
            additionalProperties: false,
            properties: { products: { type: 'boolean' }, banners_min: bannerCount, banners_max: bannerCount },
          },
          legacy_image_type: imageType,
          legacy_image_type_by_banners: {
            type: 'object',
            propertyNames: { pattern: '^[0-9]+$' },
            additionalProperties: imageType,
          },
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

  it('has unique keys, banners_max >= banners_min, and by-banner image types inside that range', () => {
    const keys = list.designs.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const { key, needs, legacy_image_type_by_banners: byBanners } of list.designs) {
      expect(needs.banners_max, key).toBeGreaterThanOrEqual(needs.banners_min);
      for (const count of Object.keys(byBanners ?? {})) {
        expect(Number(count), `${key}: legacy_image_type_by_banners["${count}"]`).toBeGreaterThanOrEqual(needs.banners_min);
        expect(Number(count), `${key}: legacy_image_type_by_banners["${count}"]`).toBeLessThanOrEqual(needs.banners_max);
      }
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
