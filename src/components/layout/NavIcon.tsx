/**
 * The icon of a bottom-nav item. The API sends an icon name (a hint, Material-style names such as
 * `home`, `shopping_cart`) or an image URL (merchant buttons). Known names get our drawing; an image
 * URL is shown as an image; anything else gets a neutral dot.
 */
const PATHS: Record<string, string> = {
  home: 'M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z',
  apps: 'M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z',
  local_offer: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .6.2 1.1.6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM6.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  inventory_2: 'M20 2H4a2 2 0 0 0-2 2v3h1v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7h1V4a2 2 0 0 0-2-2ZM15 14H9v-2h6v2Zm5-9H4V4h16v1Z',
  shopping_cart: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7.2 14.8h9.4c.8 0 1.4-.4 1.8-1.1L22 6H5.2l-.9-2H1v2h2l3.6 7.6L5.2 16c-.7 1.3.3 2 1.8 2h12v-2H7.4l-.2-.2Z',
  more_horiz: 'M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  notifications: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2Z',
  shopping_bag: 'M18 6h-2a4 4 0 0 0-8 0H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-6-2a2 2 0 0 1 2 2h-4a2 2 0 0 1 2-2Z',
  favorite: 'm12 21.4-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3C19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.5L12 21.4Z',
  location_on: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
  compare_arrows: 'M9 14H2v2h7v3l4-4-4-4v3Zm6-1v-3h7V8h-7V5l-4 4 4 4Z',
  language: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.4 1.1-2.8 1.9-4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.3-3.6C8.9 5.5 8.4 6.7 8.1 8ZM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.4-1.1 2.8-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6Zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4Z',
  local_shipping: 'M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5l-3-4ZM6 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm13.5-9 2 2.5H17V9.5h2.5ZM18 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  verified: 'm23 12-2.4-2.8.3-3.7-3.6-.8-1.9-3.2L12 3 8.6 1.5 6.7 4.7l-3.6.8.3 3.7L1 12l2.4 2.8-.3 3.7 3.6.8 1.9 3.2L12 21l3.4 1.5 1.9-3.2 3.6-.8-.3-3.7L23 12Zm-12.9 4.7-3.8-3.8 1.5-1.5 2.3 2.3 5.8-5.8 1.5 1.5-7.3 7.3Z',
  payments: 'M19 14V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Zm-9-1a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm13-6v11a2 2 0 0 1-2 2H4v-2h17V7h2Z',
  support_agent: 'M21 12.2A9 9 0 0 0 3 12.3a2 2 0 0 0-1 1.7v2a2 2 0 0 0 2 2h1v-6.1a7 7 0 0 1 14 0V19h-8v2h8a2 2 0 0 0 2-2v-1.2a2 2 0 0 0 1-1.7v-2.3a2 2 0 0 0-1-1.6ZM9 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3-2.9A6 6 0 0 0 6 11.5a8.1 8.1 0 0 0 4.9-5.9A8 8 0 0 0 18 11.1Z',
  receipt_long:'M19.5 3.5 18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V2l-1.5 1.5ZM19 19a1 1 0 0 1-2 0v-3H8V5h11v14ZM9 7h6v2H9V7Zm7 0h2v2h-2V7Zm-7 3h6v2H9v-2Zm7 0h2v2h-2v-2Z',
};

export function NavIcon({ icon, size = 24 }: { icon: string | null; size?: number }) {
  if (icon && /^https?:\/\//i.test(icon)) {
    // eslint-disable-next-line @next/next/no-img-element -- merchant icon from any CDN
    return <img src={icon} alt="" width={size} height={size} style={{ objectFit: 'contain' }} />;
  }
  const path = (icon && PATHS[icon]) || 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d={path} />
    </svg>
  );
}
