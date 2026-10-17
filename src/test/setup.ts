import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// The full suite runs ~150 jsdom files in parallel; the default 1 s for findBy / waitFor made a
// different async test miss its update on each loaded run (each passes alone). 5 s, same assertions.
configure({ asyncUtilTimeout: 5_000 });

// next/navigation hooks need the App Router; components under test only read the path.
vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
