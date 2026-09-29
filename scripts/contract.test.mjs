import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const home = () => JSON.parse(fs.readFileSync('src/test/fixtures/v3/home.en.json', 'utf8')).data;

describe('contract validator', () => {
  it('accepts a real response', () => {
    expect(validate('Home', home())).toEqual([]);
  });

  it('rejects a legacy numeric type code', () => {
    const data = home();
    data.sections[0].banners[0].target = { type: 7, link: 'https://x' };
    expect(validate('Home', data).length).toBeGreaterThan(0);
  });

  it('rejects an unknown layout', () => {
    const data = home();
    data.sections[0].layout = 'image_type_6';
    expect(validate('Home', data).join()).toContain('layout');
  });

  it('rejects a missing or extra price field', () => {
    const data = home();
    const product = data.sections.find((s) => s.products.length).products[0];
    delete product.price.amount;
    product.price.discount_price = 10;
    expect(validate('Home', data).length).toBeGreaterThan(0);
  });

  it('accepts null targets only where the contract allows them', () => {
    const data = home();
    data.sections[0].banners[0].target = null;
    expect(validate('Home', data)).toEqual([]);
    data.featuredCategories[0].target = null;
    expect(validate('Home', data).length).toBeGreaterThan(0);
  });
});
