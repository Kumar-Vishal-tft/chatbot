import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Prevent multiple instances of Redis in development due to Next.js hot reloading
const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis = globalForRedis.redis ?? new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('error', (err) => {
  console.error('Redis client connection error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis database');
});
