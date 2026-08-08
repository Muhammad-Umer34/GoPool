import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);

  // Fallback in-memory map for dev if env variables missing
  private localCache = new Map<string, { value: any; expiry: number }>();

  onModuleInit() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      try {
        this.client = new Redis({ url, token });
        this.logger.log('Connected to Upstash Redis Cloud successfully');
      } catch (err: any) {
        this.logger.error(`Upstash Redis connection error: ${err.message}`);
      }
    } else {
      this.logger.warn('UPSTASH_REDIS_REST_URL / TOKEN not set. Falling back to local memory store.');
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds) {
        await this.client.set(key, JSON.stringify(value), { ex: ttlSeconds });
      } else {
        await this.client.set(key, JSON.stringify(value));
      }
    } else {
      const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
      this.localCache.set(key, { value, expiry });
    }
  }

  async get(key: string): Promise<any> {
    if (this.client) {
      const res = await this.client.get(key);
      if (!res) return null;
      try {
        return typeof res === 'string' ? JSON.parse(res) : res;
      } catch {
        return res;
      }
    } else {
      const item = this.localCache.get(key);
      if (!item) return null;
      if (Date.now() > item.expiry) {
        this.localCache.delete(key);
        return null;
      }
      return item.value;
    }
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
    } else {
      this.localCache.delete(key);
    }
  }

  async blacklistToken(token: string, ttlSeconds = 900): Promise<void> {
    const key = `blacklist:${token}`;
    await this.set(key, true, ttlSeconds);
    this.logger.log(`Access Token blacklisted in Upstash Redis (TTL: ${ttlSeconds}s)`);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:${token}`;
    const result = await this.get(key);
    return Boolean(result);
  }
}
