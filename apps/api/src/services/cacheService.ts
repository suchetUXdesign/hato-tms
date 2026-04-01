import Redis from "ioredis";

let redis: Redis | null = null;
let isRedisAvailable = false;

function getClient(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("[CacheService] REDIS_URL not set — caching disabled");
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", () => {
      isRedisAvailable = true;
      console.log("[CacheService] Redis connected");
    });

    redis.on("error", (err) => {
      isRedisAvailable = false;
      console.warn("[CacheService] Redis error:", err.message);
    });

    redis.on("close", () => {
      isRedisAvailable = false;
    });

    // Attempt connection but don't block
    redis.connect().catch(() => {
      isRedisAvailable = false;
      console.warn("[CacheService] Redis not available — caching disabled");
    });

    return redis;
  } catch {
    console.warn("[CacheService] Failed to create Redis client — caching disabled");
    return null;
  }
}

export async function get<T = unknown>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client || !isRedisAvailable) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function set(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  const client = getClient();
  if (!client || !isRedisAvailable) return;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch {
    // Graceful fallback
  }
}

export async function del(key: string): Promise<void> {
  const client = getClient();
  if (!client || !isRedisAvailable) return;

  try {
    await client.del(key);
  } catch {
    // Graceful fallback
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const client = getClient();
  if (!client || !isRedisAvailable) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Graceful fallback
  }
}
