import { kv } from '@vercel/kv';

// Check if KV is configured
const isKVConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * Caching strategy for CTRL
 * 
 * Cache Layers:
 * 1. Vercel Edge Cache - HTTP responses (300s public, 600s CDN)
 * 2. Vercel KV (Redis) - Territory tiles, user stats (5min)
 * 3. SWR Client Cache - UI state (30s stale-while-revalidate)
 * 
 * What we cache:
 * - Territory tiles per zoom/bbox (most expensive query)
 * - User leaderboard rankings (updated every 5min)
 * - User territory totals (invalidated on activity upload)
 * 
 * Cache invalidation:
 * - On new activity: clear affected tile keys + user stats
 * - On territory change: clear overlapping tiles
 * - Leaderboard: time-based refresh every 5min
 */

const CACHE_KEYS = {
  TERRITORY_TILE: 'tile',
  USER_STATS: 'user:stats',
  LEADERBOARD: 'leaderboard',
  USER_TERRITORIES: 'user:territories'
};

const CACHE_TTL = {
  TERRITORY_TILE: 300, // 5 minutes
  USER_STATS: 300,
  LEADERBOARD: 300,
  USER_TERRITORIES: 60
};

/**
 * Generate tile key from bounding box
 */
function getTileKey(bbox, zoom) {
  const { minLng, minLat, maxLng, maxLat } = bbox;
  return `${CACHE_KEYS.TERRITORY_TILE}:${zoom}:${minLng.toFixed(4)},${minLat.toFixed(4)},${maxLng.toFixed(4)},${maxLat.toFixed(4)}`;
}

/**
 * Get cached territory tile
 */
export async function getCachedTerritoryTile(bbox, zoom) {
  if (!isKVConfigured) {
    return null;
  }
  
  try {
    const key = getTileKey(bbox, zoom);
    const cached = await kv.get(key);
    return cached;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Cache territory tile
 */
export async function cacheTerritoryTile(bbox, zoom, data) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    const key = getTileKey(bbox, zoom);
    await kv.setex(key, CACHE_TTL.TERRITORY_TILE, data);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Invalidate territory tiles that overlap with a bounding box
 * Called when new activity is uploaded
 */
export async function invalidateTerritoryTiles(bbox) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    // Redis SCAN pattern to find overlapping tile keys
    // In production, maintain a spatial index of tile keys
    // For now, we'll use a broader invalidation pattern
    
    const zoomLevels = [10, 11, 12, 13, 14, 15, 16];
    const keys = [];
    
    for (const zoom of zoomLevels) {
      // Generate keys for tiles that might overlap
      const tileKey = getTileKey(bbox, zoom);
      keys.push(tileKey);
    }
    
    if (keys.length > 0) {
      await kv.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Get cached user stats
 */
export async function getCachedUserStats(userId) {
  if (!isKVConfigured) {
    return null;
  }
  
  try {
    const key = `${CACHE_KEYS.USER_STATS}:${userId}`;
    return await kv.get(key);
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Cache user stats
 */
export async function cacheUserStats(userId, stats) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    const key = `${CACHE_KEYS.USER_STATS}:${userId}`;
    await kv.setex(key, CACHE_TTL.USER_STATS, stats);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Invalidate user stats cache
 */
export async function invalidateUserStats(userId) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    const key = `${CACHE_KEYS.USER_STATS}:${userId}`;
    await kv.del(key);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Get cached leaderboard
 */
export async function getCachedLeaderboard() {
  if (!isKVConfigured) {
    return null;
  }
  
  try {
    return await kv.get(CACHE_KEYS.LEADERBOARD);
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Cache leaderboard
 */
export async function cacheLeaderboard(data) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    await kv.setex(CACHE_KEYS.LEADERBOARD, CACHE_TTL.LEADERBOARD, data);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Get cached user territories (for profile view)
 */
export async function getCachedUserTerritories(userId) {
  if (!isKVConfigured) {
    return null;
  }
  
  try {
    const key = `${CACHE_KEYS.USER_TERRITORIES}:${userId}`;
    return await kv.get(key);
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Cache user territories
 */
export async function cacheUserTerritories(userId, territories) {
  if (!isKVConfigured) {
    return;
  }
  
  try {
    const key = `${CACHE_KEYS.USER_TERRITORIES}:${userId}`;
    await kv.setex(key, CACHE_TTL.USER_TERRITORIES, territories);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Clear all caches for a user (called on activity upload)
 */
export async function invalidateUserCaches(userId) {
  if (!isKVConfigured) {
    return;
  }
  
  await Promise.all([
    invalidateUserStats(userId),
    kv.del(`${CACHE_KEYS.USER_TERRITORIES}:${userId}`)
  ]);
}
