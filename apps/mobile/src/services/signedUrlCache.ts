import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SignedUrlCacheEntry {
  signedUrl: string;
  expiresAtMs: number;
  lastAccessMs: number;
  userScope: string;
}

const CACHE_STORAGE_PREFIX = '@passive_shopping:signed_url_cache_v1:';

const DEFAULT_TTL_SECONDS = 3600;
const REFRESH_WINDOW_SECONDS = 300; // 5 minutes before expiry
const JITTER_MIN_SECONDS = 30;
const JITTER_MAX_SECONDS = 90;
const MAX_ENTRIES = 500;
const STALE_CUTOFF_MS = 24 * 60 * 60 * 1000; // drop entries >24h past expiry

type CacheMap = Map<string, SignedUrlCacheEntry>;

let memoryCache: CacheMap = new Map();
let inFlight: Map<string, Promise<string | null>> = new Map();
let activeUserScope: string | null = null;
let initializedForScope: string | null = null;
let persistTimeout: NodeJS.Timeout | null = null;

function getStorageKey(userScope: string) {
  return `${CACHE_STORAGE_PREFIX}${userScope || 'anonymous'}`;
}

function getNowMs() {
  return Date.now();
}

function getJitterMs() {
  const range = JITTER_MAX_SECONDS - JITTER_MIN_SECONDS;
  const randSeconds = JITTER_MIN_SECONDS + Math.random() * range;
  return Math.floor(randSeconds * 1000);
}

async function loadCacheForScope(userScope: string) {
  const storageKey = getStorageKey(userScope);
  try {
    const json = await AsyncStorage.getItem(storageKey);
    const now = getNowMs();

    memoryCache = new Map();

    if (json) {
      const raw = JSON.parse(json) as Record<string, SignedUrlCacheEntry>;
      Object.entries(raw).forEach(([key, entry]) => {
        if (!entry || typeof entry.expiresAtMs !== 'number') return;
        // Skip very stale entries
        if (entry.expiresAtMs < now - STALE_CUTOFF_MS) return;
        memoryCache.set(key, entry);
      });
    }
  } catch (error) {
    console.error('Error loading signed URL cache:', error);
    memoryCache = new Map();
  }
}

async function persistCache() {
  if (!activeUserScope) return;
  const storageKey = getStorageKey(activeUserScope);

  const asObject: Record<string, SignedUrlCacheEntry> = {};
  memoryCache.forEach((value, key) => {
    asObject[key] = value;
  });

  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(asObject));
  } catch (error) {
    console.error('Error persisting signed URL cache:', error);
  }
}

function schedulePersist() {
  if (persistTimeout) return;
  persistTimeout = setTimeout(() => {
    persistTimeout = null;
    void persistCache();
  }, 300);
}

async function ensureInitialized(userScope: string) {
  if (initializedForScope === userScope) {
    return;
  }

  activeUserScope = userScope;
  initializedForScope = userScope;
  inFlight.clear();
  await loadCacheForScope(userScope);
}

async function evictIfNeeded(now: number) {
  if (memoryCache.size <= MAX_ENTRIES) return;

  const entries = Array.from(memoryCache.entries());
  // Sort by lastAccessMs ascending (oldest first)
  entries.sort((a, b) => a[1].lastAccessMs - b[1].lastAccessMs);

  const toRemove = entries.length - MAX_ENTRIES;
  for (let i = 0; i < toRemove; i++) {
    memoryCache.delete(entries[i][0]);
  }

  schedulePersist();
}

function startFetch(
  key: string,
  userScope: string,
  ttlSeconds: number,
  fetcher: () => Promise<string | null>
): Promise<string | null> {
  const promise = (async () => {
    const requestedAt = getNowMs();
    try {
      const url = await fetcher();
      if (!url) {
        return null;
      }

      const ttlMs = (ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
      const entry: SignedUrlCacheEntry = {
        signedUrl: url,
        expiresAtMs: requestedAt + ttlMs,
        lastAccessMs: requestedAt,
        userScope,
      };

      memoryCache.set(key, entry);
      await evictIfNeeded(requestedAt);
      schedulePersist();
      return url;
    } catch (error) {
      console.error('Error creating signed URL (cached):', error);
      return null;
    } finally {
      const current = inFlight.get(key);
      if (current === promise) {
        inFlight.delete(key);
      }
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export interface GetSignedUrlCachedOptions {
  ttlSeconds?: number;
}

interface GetSignedUrlCachedInternalParams {
  key: string;
  userScope: string;
  ttlSeconds?: number;
  fetcher: () => Promise<string | null>;
}

/**
 * Core cache logic for signed URLs.
 *
 * - Dedupes concurrent fetches via inFlight map.
 * - Returns cached URL when fresh.
 * - When within refresh window, returns cached URL immediately and
 *   triggers a background refresh (soft refresh).
 * - When expired or missing, blocks and fetches a new URL.
 */
export async function getSignedUrlCachedInternal(
  params: GetSignedUrlCachedInternalParams
): Promise<string | null> {
  const { key, userScope, ttlSeconds = DEFAULT_TTL_SECONDS, fetcher } = params;

  await ensureInitialized(userScope);

  const now = getNowMs();
  const refreshWindowMs = REFRESH_WINDOW_SECONDS * 1000;
  const jitterMs = getJitterMs();

  const cached = memoryCache.get(key);

  // Ignore cache entries from different user scopes
  if (cached && cached.userScope !== userScope) {
    memoryCache.delete(key);
  }

  const entry = memoryCache.get(key);

  if (entry) {
    entry.lastAccessMs = now;

    if (now < entry.expiresAtMs - refreshWindowMs - jitterMs) {
      // Fresh
      return entry.signedUrl;
    }

    if (now >= entry.expiresAtMs) {
      // Expired: block and fetch a new one
      const existing = inFlight.get(key);
      if (existing) {
        return existing;
      }
      return startFetch(key, userScope, ttlSeconds, fetcher);
    }

    // Within refresh window but not expired: soft refresh.
    if (!inFlight.has(key)) {
      void startFetch(key, userScope, ttlSeconds, fetcher);
    }

    return entry.signedUrl;
  }

  // Cache miss: fetch and store
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  return startFetch(key, userScope, ttlSeconds, fetcher);
}

/**
 * Clear all in-memory cache and persisted cache for the current scope.
 * Useful for tests or explicit cache resets.
 */
export async function clearSignedUrlCache(userScope: string) {
  await ensureInitialized(userScope);
  memoryCache.clear();
  inFlight.clear();
  schedulePersist();
}


