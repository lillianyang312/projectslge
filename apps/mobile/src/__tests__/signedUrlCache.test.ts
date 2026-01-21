import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

import {
  getSignedUrlCachedInternal,
  clearSignedUrlCache,
} from '../services/signedUrlCache';

describe('signedUrlCache', () => {
  const userScope = 'user-1';
  const key = 'item-images:some/path.jpg';

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await clearSignedUrlCache(userScope);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cached URL on subsequent calls without re-fetching', async () => {
    const fetcher = jest.fn(async () => 'https://example.com/image-1');

    const first = await getSignedUrlCachedInternal({
      key,
      userScope,
      ttlSeconds: 3600,
      fetcher,
    });

    const second = await getSignedUrlCachedInternal({
      key,
      userScope,
      ttlSeconds: 3600,
      fetcher,
    });

    expect(first).toBe('https://example.com/image-1');
    expect(second).toBe('https://example.com/image-1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent fetches for the same key', async () => {
    const fetcher = jest.fn(async () => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'https://example.com/image-2';
    });

    const [a, b, c] = await Promise.all([
      getSignedUrlCachedInternal({ key, userScope, ttlSeconds: 3600, fetcher }),
      getSignedUrlCachedInternal({ key, userScope, ttlSeconds: 3600, fetcher }),
      getSignedUrlCachedInternal({ key, userScope, ttlSeconds: 3600, fetcher }),
    ]);

    expect(a).toBe('https://example.com/image-2');
    expect(b).toBe('https://example.com/image-2');
    expect(c).toBe('https://example.com/image-2');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});


