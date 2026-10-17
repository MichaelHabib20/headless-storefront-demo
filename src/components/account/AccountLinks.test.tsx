/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountLinks } from './AccountLinks';

describe('AccountLinks', () => {
  it('is the account menu: a named navigation of icon rows, the chevron turning in RTL', () => {
    render(
      <AccountLinks
        label="حسابي"
        links={[
          { href: '/ar/account/profile', label: 'ملفي الشخصي', kind: 'person' },
          { href: '/ar/account/order-history', label: 'طلباتي', kind: 'history' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'حسابي' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['ملفي الشخصي', '/ar/account/profile'],
      ['طلباتي', '/ar/account/order-history'],
    ]);
    // icons are decoration: the link's name is its text
    expect(links[0].querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(links[0].querySelector('.flip-rtl')).not.toBeNull();
  });
});
