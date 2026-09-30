import { describe, expect, it } from 'vitest';
import { checkSource } from './lib/rules.mjs';

const rulesHit = (file, source) => checkSource(file, source).map((v) => v.rule);

describe('architecture rules', () => {
  it('catches direct API calls outside the SDK', () => {
    expect(rulesHit('src/components/home/X.tsx', "const r = await fetch('/api/customer/home/sections');")).toContain('sdk-only-network');
    expect(rulesHit('src/sdk/v3/http.ts', 'res = await doFetch(root + path)')).toEqual([]);
  });

  it('catches legacy fields', () => {
    expect(rulesHit('src/components/home/X.tsx', 'if (section.image_type === 3) {')).toContain('no-legacy-fields');
  });

  it('catches link building outside routing', () => {
    expect(rulesHit('src/components/X.tsx', "if (target.type === 'product') return `/p/${target.slug}`;")).toContain('links-via-routing');
    expect(rulesHit('src/components/X.tsx', '<a href={`/p/${product.slug}`}>')).toContain('links-via-routing');
    expect(rulesHit('src/components/X.tsx', "const href = '/brands/' + brand.slug;")).toContain('links-via-routing');
    expect(rulesHit('src/lib/routing.ts', "case 'product':")).toEqual([]);
    // complete URLs from the backend are fine
    expect(rulesHit('src/components/X.tsx', '<a href={profile.url} rel="noopener">')).toEqual([]);
  });

  it('catches price math in the UI', () => {
    expect(rulesHit('src/components/P.tsx', 'const pct = (price.compareAt - price.amount) / price.compareAt;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const total = product.price.amount * qty;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'Math.round(price.amount)')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const sorted = products.sort((a, b) => a.price.amount - b.price.amount);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const sum = items.reduce((total, item) => total + item.lineTotal.amount, 0);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const left = Math.max(0, minimum.amount.amount - subtotal.amount);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const hasCents = price.amount % 1 !== 0;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', '<Price price={product.price} locale={locale} />')).toEqual([]);
  });

  it('catches math on the minimum-order progress', () => {
    expect(rulesHit('src/components/cart/M.tsx', 'const missing = 100 - minimumOrder.progressPercent;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'const degrees = minimumOrder.progressPercent * 3.6;')).toContain('no-price-math');
    // used as it is, e.g. as a CSS value, is fine
    expect(rulesHit('src/components/cart/M.tsx', "const bar = { '--cart-progress': `${minimumOrder.progressPercent}%` } as CSSProperties;")).toEqual([]);
  });

  it('catches price-based decisions (tightened: any comparison, not only with a literal)', () => {
    expect(rulesHit('src/components/cart/M.tsx', 'const reached = minimumOrder.remaining.amount === 0;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'if (summary.subtotal.amount >= minimumOrder.amount.amount) {')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'const almost = minimumOrder.progressPercent > 80;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', '{summary.discount && (')).toEqual([]);
    // reading the numbers for analytics is allowed by the contract; `=>` is not a comparison
    expect(rulesHit('src/components/cart/M.tsx', 'track(cart.items.map((item) => item.lineTotal.amount));')).toEqual([]);
    expect(rulesHit('src/components/cart/M.tsx', '<Money value={minimumOrder.amount} />')).toEqual([]);
  });

  it('catches business rules on prices (regression from the AI guardrail trial)', () => {
    expect(rulesHit('src/components/P.tsx', 'const freeDelivery = product.price.amount > 500;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'if (1000 <= price.compareAt) {')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'price.compareAt !== null')).toEqual([]);
  });

  it('lets only src/money read the money texts', () => {
    const fails = [
      '<span className={styles.price}>{product.price.display}</span>',
      '{price?.compareAtDisplay && <s>{price.compareAtDisplay}</s>}',
      "const badge = price.discountLabel ?? '';",
      'const { display } = cart.summary.total;',
      'const texts = lines.map(({ amount, display }) => display);',
      "const text = total['display'];",
      'function Total({ display }: Money) {',
    ];
    for (const line of fails) expect(rulesHit('src/components/cart/X.tsx', line), line).toContain('money-via-components');
    expect(rulesHit('src/lib/x.ts', 'return money.display;')).toContain('money-via-components');
    // only a filter's / an option's own drawing hint is exempt, not money next to it
    expect(rulesHit('src/components/catalog/X.tsx', '<span>{facet.range.min.display}</span>')).toContain('money-via-components');
    expect(rulesHit('src/components/catalog/X.tsx', '<span>{facetPrice.display}</span>')).toContain('money-via-components');
    expect(rulesHit('src/app/[locale]/cart/page.tsx', '<dd>{cart.summary.total?.display}</dd>')).toContain('money-via-components');

    const passes = [
      '<Money value={cart.summary.total} as="dd" data-testid="cart-total" />',
      "el.style.display = 'none';",
      '<h2 className={styles.display}>{title}</h2>',
      "<div style={{ display: 'grid', gap: 8 }}>",
      "<div style={{ display }}>",
      "const visible = getComputedStyle(node).display !== 'none';",
      // a product option's drawing hint is not money (ProductOption.display)
      "return LOOKS.has(option.display) ? option.display : 'buttons';",
      "const swatches = option?.display === 'color';",
      // drawing hints of listing filters and product options are not money
      "const swatches = facet.display === 'color';",
      '<ValueMark hint={facet.display} value={value} />',
      "if (option.display === 'dropdown') {",
    ];
    for (const line of passes) expect(rulesHit('src/components/cart/X.tsx', line), line).toEqual([]);
    // …but only under that name: a price, or a list of options, is still caught
    for (const line of ['const text = options.display;', 'const text = optionPrice.display;', '<span>{product.price.display}</span>']) {
      expect(rulesHit('src/components/product/X.tsx', line), line).toContain('money-via-components');
    }
    // the money components themselves, and tests checking what the API sent
    expect(rulesHit('src/money/Price.tsx', '{price.compareAtDisplay}')).toEqual([]);
    expect(rulesHit('src/components/cart/X.test.tsx', 'expect(total.textContent).toBe(cart.summary.total.display);')).toEqual([]);
  });

  it('catches money formatted in the storefront', () => {
    const fails = [
      "new Intl.NumberFormat('en', { style: 'currency', currency: price.currency }).format(price.amount)",
      'const count = new Intl.NumberFormat(locale).format(items);',
      '<span>{price.amount.toFixed(2)}</span>',
      'const text = total.amount.toLocaleString();',
      'const text = `${price.currency} ${price.amount}`;',
      "const text = 'EGP ' + total.amount;",
      '<span className={styles.amount}>{price.amount}</span>',
      '<span>{price.currency}</span>',
      '<small>-{price.discountPercent}%</small>',
      'const text = formatNumber(price.amount, locale);',
      'const text = String(item.lineTotal.amount);',
      'formatMoney(total.amount, total.currency, locale)',
      'const { amount, compareAt } = formatPrice(product.price, locale);',
    ];
    for (const line of fails) expect(rulesHit('src/components/product/X.tsx', line), line).toContain('no-money-formatting');

    const passes = [
      '<Price price={product.price} locale={locale} className={styles.price} />',
      '<Money value={minimumOrder.amount} />',
      '<dd data-testid="cart-item-count">{formatQuantity(summary.itemCount, locale)}</dd>',
      'const note = labels.note.replace("{count}", formatNumber(visible.length, locale));',
      "const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(created);",
      'const day = created.toLocaleDateString(locale);',
    ];
    for (const line of passes) expect(rulesHit('src/components/product/X.tsx', line), line).toEqual([]);
    // counts and quantities are formatted in one place
    expect(rulesHit('src/lib/numbers.ts', "return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(value);")).toEqual([]);
  });

  it('tells the reader to use the money components', () => {
    const [violation] = checkSource('src/components/P.tsx', '<span>{price.display}</span>');
    expect(violation.message).toContain('<Money value={...} />');
    expect(violation.message).toContain('<Price price={...}');
    const [formatting] = checkSource('src/components/P.tsx', 'const t = price.amount.toFixed(2);');
    expect(formatting.message).toContain('<Money value={...} />');
  });

  it('catches hardcoded UI text and locale paths', () => {
    expect(rulesHit('src/components/P.tsx', '<span className={s.save}>You save {amount}</span>')).toContain('ui-text-in-i18n');
    expect(rulesHit('src/components/P.tsx', '          Free delivery')).toContain('ui-text-in-i18n');
    expect(rulesHit('src/components/P.tsx', '<span>{t("freeDelivery")}</span>')).toEqual([]);
    // arrow functions are code, not JSX text (false positive reported by the cart agent)
    expect(rulesHit('src/components/P.tsx', '    startTransition(() => setState({ busy: true }));')).toEqual([]);
    expect(rulesHit('src/components/P.tsx', '  const items = cart.items.map((item) => toLine({ item, locale }));')).toEqual([]);
    expect(rulesHit('src/components/P.tsx', '<a href="/en/deals">')).toContain('links-via-routing');
  });

  it('catches env reads in client components', () => {
    expect(rulesHit('src/components/C.tsx', "'use client';\nconst key = process.env.SC_API_KEY;")).toContain('no-env-in-client');
    expect(rulesHit('src/lib/storefront.server.ts', 'const key = process.env.SC_API_KEY;')).toEqual([]);
  });

  it('catches raw HTML and hardcoded store hosts', () => {
    expect(rulesHit('src/components/F.tsx', '<div dangerouslySetInnerHTML={{ __html: x }} />')).toContain('no-raw-html');
    expect(rulesHit('src/components/F.tsx', 'ref.current.innerHTML = product.description.html;')).toContain('no-raw-html');
    // the one component that shows the API's cleaned RichText
    expect(rulesHit('src/components/ui/RichText.tsx', '<div dangerouslySetInnerHTML={{ __html: value.html }} />')).toEqual([]);
    expect(rulesHit('src/lib/x.ts', "const base = 'https://staging-seif.witheldokan.com';")).toContain('no-hardcoded-store');
  });

  it('catches writes on page load (regression from the second AI guardrail trial)', () => {
    const onLoad = "'use client';\nuseEffect(() => {\n  void markAllNotificationsReadAction(locale);\n}, [locale]);";
    expect(rulesHit('src/components/notifications/MarkAllReadOnLoad.tsx', onLoad)).toContain('no-write-on-load');
    // a write in a click handler is fine; an effect without a server action is fine
    expect(rulesHit('src/components/N.tsx', "'use client';\nconst onClick = () => markAllNotificationsReadAction(locale);")).toEqual([]);
    expect(rulesHit('src/components/N.tsx', "'use client';\nuseEffect(() => { window.addEventListener('resize', update); }, []);")).toEqual([]);
    // the action passed in as a prop under another name (how the trial agent wrote it)
    const viaProp = "'use client';\nuseEffect(() => {\n  markAllRead().catch(() => undefined);\n}, [markAllRead]);";
    expect(rulesHit('src/components/notifications/MarkAllReadOnLoad.tsx', viaProp)).toContain('no-write-on-load');
    expect(rulesHit('src/components/C.tsx', "'use client';\nuseEffect(() => { addToCart(id); }, [id]);")).toContain('no-write-on-load');
    expect(rulesHit('src/components/C.tsx', "'use client';\nuseEffect(() => { const t = setTimeout(go, 9); return () => clearTimeout(t); }, []);")).toEqual([]);
  });

  it('places orders only through the checkout page action', () => {
    expect(rulesHit('src/components/product/BuyNow.tsx', 'await placeOrder(storefrontClient(), ctx, input);')).toContain('place-order-one-door');
    expect(rulesHit('src/app/[locale]/p/[slug]/actions.ts', "import { placeOrderAction } from '../../checkout/actions';")).toContain('place-order-one-door');
    expect(rulesHit('src/lib/quick-order.ts', 'return placeOrder(client, ctx, { checkout, acceptTerms: true });')).toContain('place-order-one-door');
    // the checkout route and the SDK are the door
    expect(rulesHit('src/app/[locale]/checkout/actions.ts', '({ next } = await placeOrder(storefrontClient(), ctx, {')).toEqual([]);
    expect(rulesHit('src/app/[locale]/checkout/page.tsx', 'placeAction={placeOrderAction}')).toEqual([]);
    expect(rulesHit('src/sdk/v3/checkout.ts', 'export function placeOrder(client, ctx, input) {')).toEqual([]);
  });

  it('never lets the storefront build the total an order is placed for', () => {
    expect(rulesHit('src/app/[locale]/checkout/actions.ts', 'body: { selections, expectedTotal: checkout.totals.total.amount }')).toContain('total-from-checkout');
    expect(rulesHit('src/components/checkout/X.tsx', 'const expectedTotal = subtotal + deliveryFee;')).toContain('total-from-checkout');
    expect(rulesHit('src/app/[locale]/checkout/actions.ts', 'const shown = { ...checkout, totals: firstCheckout.totals };')).toContain('total-from-checkout');
    expect(rulesHit('src/components/checkout/X.tsx', 'checkout.totals.total = lastTotal;')).toContain('total-from-checkout');
    // handing the checkout on unchanged, and reading its total for display, are fine
    expect(rulesHit('src/components/checkout/X.tsx', 'placeAction(locale, { checkout, note, acceptTerms: terms, attemptKey, acceptPaymentChange: consent })')).toEqual([]);
    expect(rulesHit('src/components/checkout/X.tsx', '<TotalLines lines={checkout.totals.lines} total={checkout.totals.total} locale={locale} />')).toEqual([]);
    expect(rulesHit('src/sdk/v3/checkout.ts', 'expectedTotal: checkout.totals.total.amount,')).toEqual([]);
  });

  it('enables the place-order button only by canPlaceOrder', () => {
    const hits = (line) => rulesHit('src/components/checkout/PlaceOrder.tsx', line);
    expect(hits('const enabled = (checkout.canPlaceOrder || checkout.missing.length === 0) && termsAccepted;')).toContain('place-order-gate');
    expect(hits('const enabled = checkout.blockers.length === 0 || checkout.canPlaceOrder;')).toContain('place-order-gate');
    expect(hits('<button disabled={!checkout.canPlaceOrder && checkout.blockers.length > 0}>')).toContain('place-order-gate');
    expect(hits('const ready = { ...checkout, canPlaceOrder: true };')).toContain('place-order-gate');
    expect(hits('checkout.canPlaceOrder = !missing.length;')).toContain('place-order-gate');
    // the backend switch, narrowed by the terms and a pending change
    expect(hits('const enabled = checkout.canPlaceOrder && termsAccepted && !pending && !placing;')).toEqual([]);
    expect(hits("if (checkout.canPlaceOrder !== true) return { ok: false, message: t('checkoutErrorNotReady'), attemptKey };")).toEqual([]);
  });

  it('never picks a default choice in checkout', () => {
    expect(rulesHit('src/components/checkout/PaymentSection.tsx', 'const chosen = shown.paymentMethodId ?? methods[0].id;')).toContain('checkout-no-own-defaults');
    expect(rulesHit('src/components/checkout/F.tsx', 'const address = addresses?.[0];')).toContain('checkout-no-own-defaults');
    expect(rulesHit('src/components/checkout/F.tsx', 'const address = checkout.fulfilment.addresses.find((a) => a.isDefault);')).toContain('checkout-no-own-defaults');
    expect(rulesHit('src/app/[locale]/checkout/page.tsx', 'const first = { paymentMethodId: checkout.payment.methods.at(0)?.id };')).toContain('checkout-no-own-defaults');
    // drawing the list and the backend echo is fine
    expect(rulesHit('src/components/checkout/F.tsx', '{addresses.map((address) => (')).toEqual([]);
    expect(rulesHit('src/components/checkout/F.tsx', '{address.isDefault && <span>{t("checkoutAddressDefault")}</span>}')).toEqual([]);
  });

  it('catches placing an order on page load', () => {
    expect(rulesHit('src/components/checkout/AutoPlace.tsx', "'use client';\nuseEffect(() => {\n  placeOrder();\n}, []);")).toContain('no-write-on-load');
  });

  it('catches order actions decided by the storefront (account pages)', () => {
    const fails = [
      "{order.status.code === 'pending' && <CancelButton />}",
      "const canCancel = order.status.code !== 'delivered';",
      "if ('processing' === summary.status.code) {",
      'switch (order.status.code) {',
      "const cancellable = ['pending', 'confirmed'].includes(order.status.code);",
      'const recent = Date.now() - new Date(order.placedAt).getTime() < DAY;',
      'const age = new Date(order.placedAt).getTime();',
    ];
    for (const line of fails) expect(rulesHit('src/components/account/X.tsx', line), line).toContain('order-actions-from-api');

    const passes = [
      '{order.actions.canCancel && <button type="button">{t(\'orderCancel\')}</button>}',
      '<span data-status={status.code} data-tone={statusTone(status.code)}>{status.label}</span>',
      '<time dateTime={order.placedAt}>{formatDate(order.placedAt, locale)}</time>',
      "if (error.kind === 'cannot_cancel') {",
      "reached={!checkout.blockers.some((blocker) => blocker.code === 'minimum_order')}",
    ];
    for (const line of passes) expect(rulesHit('src/components/account/X.tsx', line), line).toEqual([]);
  });

  it('catches address fields the storefront adds itself', () => {
    expect(rulesHit('src/components/account/AddressForm.tsx', '<input name="street" required />')).toContain('address-form-from-api');
    expect(rulesHit('src/app/[locale]/account/addresses/new/page.tsx', "<input name='field.landmark' />")).toContain('address-form-from-api');
    expect(rulesHit('src/components/checkout/X.tsx', '<input name={"building"} />')).toContain('address-form-from-api');
    // drawn from the API's list
    expect(rulesHit('src/components/account/AddressForm.tsx', 'name={`${FIELD_PREFIX}${field.name}`}')).toEqual([]);
    expect(rulesHit('src/components/account/AddressForm.tsx', '<input type="hidden" name="locale" value={locale} />')).toEqual([]);
  });

  it('ignores tests and comments', () => {
    expect(rulesHit('src/components/X.test.tsx', "fetch('/api/customer/x')")).toEqual([]);
    expect(rulesHit('src/components/X.tsx', '// never call fetch( here')).toEqual([]);
  });
});
