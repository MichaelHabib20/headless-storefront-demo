import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layout } from '@/sdk';
import { loadLayout } from '@/lib/storefront.server';
import { layoutFixture } from '@/test/fixtures';
import { GET } from './route';

vi.mock('@/lib/storefront.server', () => ({ loadLayout: vi.fn() }));

const withFavicon = (favicon: string | null): Layout => {
  const layout = layoutFixture('en');
  return { ...layout, store: { ...layout.store, favicon } };
};

beforeEach(() => {
  vi.mocked(loadLayout).mockReset();
});

describe('GET /favicon.ico', () => {
  it("redirects to the store's favicon as the backend sent it (spaces encoded)", async () => {
    vi.mocked(loadLayout).mockResolvedValue(withFavicon('https://cdn.test/uploads/logo (1).png'));
    const response = await GET();
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://cdn.test/uploads/logo%20(1).png');
  });

  it('answers 404 without a favicon, with something that is not a web URL, or without the backend', async () => {
    vi.mocked(loadLayout).mockResolvedValue(withFavicon(null));
    expect((await GET()).status).toBe(404);
    vi.mocked(loadLayout).mockResolvedValue(withFavicon('javascript:alert(1)'));
    expect((await GET()).status).toBe(404);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadLayout).mockImplementation(async () => {
      throw new Error('down');
    });
    expect((await GET()).status).toBe(404);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
