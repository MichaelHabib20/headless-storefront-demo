# src/money — money on the screen

**Maintained by SuperCommerce. Do not edit anything in this folder.**

These components are the only code allowed to put money on the screen. The backend computes
every amount and writes it as ready-to-show text in the shopper's language (`display`,
`compareAtDisplay`, `discountLabel`, e.g. "176 EGP", "1,260 جنية", "10 %"). These components show that text exactly as it is.
They never format, round or compute anything.

The folder is locked: `npm run check:rules` (part of `npm run verify`) fails if any file here
is changed, added or removed. Later it will become an npm package, and this folder will go away.

## Use

```tsx
import { DiscountLabel, Money, Price } from '@/money';

<Money value={cart.summary.total} />                   // "196.00 EGP"
<Price price={product.price} locale={locale} />        // "176 EGP", old price struck through, "10 %"
<DiscountLabel price={product.price} />                // only "10 %", e.g. as a badge on the image
```

- `null` renders nothing: a store that hides prices (`price: null`), no cart discount
  (`summary.discount: null`), no discount (`discountLabel: null`).
- `Price` reads "Now" / "Was" to screen readers (English and Arabic) when there is an old price.
- They work in server and client components, and in Arabic (RTL).

## Style them

You control how money **looks**, never what it **says**.

| Prop | On | What |
|---|---|---|
| `className` | all | Class of the outer element |
| `as` | all | Outer element: `span` (default), `strong`, `b`, `em`, `p`, `div`, `dd`, `td`, `th`, `li` |
| `data-testid` | all | Passed to the outer element |
| `classNames={{ amount, sale, compareAt, discount }}` | `Price` | A class per part. `sale` is added to `amount` when there is an old price |
| `showDiscount={false}` | `Price` | Leave the discount out (show it with `<DiscountLabel>` somewhere else) |

```tsx
<Price
  price={product.price}
  locale={locale}
  as="p"
  className={styles.price}
  classNames={{ sale: styles.sale, compareAt: styles.compareAt, discount: styles.discount }}
/>
```

Put the CSS in your own CSS module. The parts of `Price` are in reading order (price, old
price, discount), so `display: flex` with `gap` and logical properties work in both directions.

## Need something else?

A new part, another element, other labels, a new language: ask SuperCommerce. Do not copy
these components and do not format money yourself — the architecture rules block it.
