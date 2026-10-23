#!/usr/bin/env node
/**
 * Writes src/test/fixtures/v3/home-blocks.{en,ar}.json: the recorded staging home with section blocks
 * (`Section.blocks`, resolved form) on its sections, until a store with blocks can be recorded live.
 * Images and targets are the recorded banners'; the third section's blocks point at a deleted page
 * (target null). Checked by `npm run contract:check`.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.join(root, 'src/test/fixtures/v3');

const TEXT = {
  en: {
    heading: 'Everything for your baby',
    body: 'Gentle care from trusted brands, delivered to your door.',
    caption: 'Offers while stocks last',
    shop: 'Shop baby care',
    more: 'See all offers',
    alt0: 'Prescriptions: send your prescription',
  },
  ar: {
    heading: 'كل ما يحتاجه طفلك',
    body: 'عناية لطيفة من علامات تجارية موثوقة حتى باب منزلك.',
    caption: 'العروض حتى نفاد الكمية',
    shop: 'تسوق منتجات الأطفال',
    more: 'كل العروض',
    alt0: 'الروشتات: أرسل روشتتك',
  },
};

for (const locale of ['en', 'ar']) {
  const t = TEXT[locale];
  const home = JSON.parse(fs.readFileSync(path.join(dir, `home.${locale}.json`), 'utf8'));
  const [wide, grid] = home.data.sections;
  const banner = (b, { ar = false, link = true } = {}) => ({
    type: 'image',
    id: `banner-${b.id}`,
    media: {
      desktop: b.image.desktop,
      mobile: b.image.mobile,
      desktop_ar: ar ? b.image.desktop.replace(/(\.\w+)$/, '-ar$1') : null,
      mobile_ar: ar ? b.image.mobile.replace(/(\.\w+)$/, '-ar$1') : null,
    },
    alt: b.image.alt,
    target: link ? b.target : null,
  });

  // 1. Untitled: a slider (autoplay) of photos, then a row with a heading and two buttons.
  wide.blocks = {
    version: 1,
    blocks: [
      {
        type: 'slider',
        id: 'hero',
        autoplay: true,
        interval_ms: 6000,
        items: [
          { ...banner(wide.banners[0], { ar: true }), alt: t.alt0 },
          banner(grid.banners[0]),
          banner(grid.banners[1], { link: false }),
        ],
      },
      {
        type: 'row',
        align: 'center',
        items: [
          { type: 'text', text: t.heading, style: 'heading', align: 'center' },
          { type: 'button', id: 'shop', label: t.shop, target: grid.viewAll, variant: 'primary' },
          { type: 'button', label: t.more, target: null, variant: 'secondary' },
        ],
      },
    ],
  };

  // 2. "Baby Care": a grid of its banners, a text, its products as a rail (at most 4).
  grid.blocks = {
    version: 1,
    blocks: [
      { type: 'grid', columns: { mobile: 2, desktop: 3 }, gap: 's', items: grid.banners.map((b) => banner(b)) },
      { type: 'text', text: t.body, style: 'body', align: 'start' },
      { type: 'product_list', display: 'rail', limit: 4 },
    ],
  };

  // 3. A copy of "Baby Care": products as a grid (at most 6) under a caption; an image whose target was deleted.
  const third = structuredClone(grid);
  third.id = 9001;
  third.banners = [];
  third.blocks = {
    version: 1,
    blocks: [
      { type: 'text', text: t.caption, style: 'caption', align: 'end' },
      { type: 'product_list', display: 'grid', limit: 6 },
      banner(grid.banners[2], { link: false }),
    ],
  };

  home.data.sections = [wide, grid, third];
  fs.writeFileSync(path.join(dir, `home-blocks.${locale}.json`), `${JSON.stringify(home, null, 2)}\n`);
  console.log(`wrote home-blocks.${locale}.json`);
}
