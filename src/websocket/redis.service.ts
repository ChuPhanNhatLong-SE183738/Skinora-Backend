import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;
  private mockData = new Map<string, any>();
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Test connection
      await this.redis.ping();
      this.isConnected = true;
      this.logger.log('✅ Redis connected successfully');
    } catch (error) {
      this.logger.warn('⚠️ Redis connection failed, using in-memory mock');
      this.logger.warn(`Redis error: ${error.message}`);
      this.redis = null;
      this.isConnected = false;
    }
  }

  private async safeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
  ): Promise<T> {
    if (this.redis && this.isConnected) {
      try {
        return await operation();
      } catch (error) {
        this.logger.warn(
          `Redis operation failed, using fallback: ${error.message}`,
        );
        return await fallback();
      }
    } else {
      return await fallback();
    }
  }

  async checkRateLimit(
    userId: string,
    operation: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    return this.safeRedisOperation(
      async () => {
        const key = `ratelimit:${userId}:${operation}`;
        const current = await this.redis!.incr(key);
        if (current === 1) {
          await this.redis!.expire(key, windowSeconds);
        }
        return current <= limit;
      },
      () => true, // Fallback: always allow
    );
  }

  async setCallStatus(
    callId: string,
    status: string,
    metadata?: any,
  ): Promise<void> {
    return this.safeRedisOperation(
      async () => {
        const key = `call:${callId}:status`;
        const data = JSON.stringify({
          status,
          metadata,
          timestamp: new Date(),
        });
        await this.redis!.setex(key, 86400, data); // 24 hours expiry
      },
      () => {
        const key = `call:${callId}:status`;
        this.mockData.set(key, { status, metadata, timestamp: new Date() });
      },
    );
  }

  async getCallStatus(callId: string): Promise<any> {
    return this.safeRedisOperation(
      async () => {
        const key = `call:${callId}:status`;
        const data = await this.redis!.get(key);
        return data ? JSON.parse(data) : null;
      },
      () => {
        const key = `call:${callId}:status`;
        return this.mockData.get(key) || null;
      },
    );
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.safeRedisOperation(
      async () => {
        const key = `user:${userId}:online`;
        const result = await this.redis!.get(key);
        return result === 'true';
      },
      () => false, // Fallback: assume offline
    );
  }

  async queueNotification(userId: string, notification: any): Promise<void> {
    return this.safeRedisOperation(
      async () => {
        const key = `notifications:${userId}`;
        const data = JSON.stringify({
          ...notification,
          queuedAt: new Date(),
        });
        await this.redis!.lpush(key, data);
        await this.redis!.expire(key, 86400); // 24 hours
      },
      () => {
        const key = `notifications:${userId}`;
        const existing = this.mockData.get(key) || [];
        existing.push({
          ...notification,
          queuedAt: new Date(),
        });
        this.mockData.set(key, existing);
        this.logger.log(`📧 Queued notification for offline user ${userId}`);
      },
    );
  }

  async getQueuedNotifications(userId: string): Promise<any[]> {
    return this.safeRedisOperation(
      async () => {
        const key = `notifications:${userId}`;
        const notifications = await this.redis!.lrange(key, 0, -1);
        return notifications.map((n) => JSON.parse(n));
      },
      () => {
        const key = `notifications:${userId}`;
        return this.mockData.get(key) || [];
      },
    );
  }

  async addCallParticipant(
    callId: string,
    participant: {
      userId: string;
      userRole: string;
      device: string;
      uid: number;
      joinedAt: Date;
      status: string;
    },
  ): Promise<void> {
    return this.safeRedisOperation(
      async () => {
        const key = `call:${callId}:participants`;
        const participantData = JSON.stringify(participant);
        await this.redis!.sadd(key, participantData);
        await this.redis!.expire(key, 86400);
      },
      () => {
        const key = `call:${callId}:participants`;
        const existing = this.mockData.get(key) || [];
        existing.push(participant);
        this.mockData.set(key, existing);
        this.logger.log(
          `👥 Added participant to call ${callId}: ${participant.userId} (${participant.device})`,
        );
      },
    );
  }

  async getCallParticipants(callId: string): Promise<any[]> {
    return this.safeRedisOperation(
      async () => {
        const key = `call:${callId}:participants`;
        const participants = await this.redis!.smembers(key);
        return participants
          .map((p) => {
            try {
              return JSON.parse(p);
            } catch (error) {
              console.error('Error parsing participant data:', error);
              return null;
            }
          })
          .filter(Boolean);
      },
      () => {
        const key = `call:${callId}:participants`;
        return this.mockData.get(key) || [];
      },
    );
  }

  async removeCallParticipant(
    callId: string,
    userId: string,
    device: string,
  ): Promise<void> {
    return this.safeRedisOperation(
      async () => {
        const key = `call:${callId}:participants`;
        const participants = await this.getCallParticipants(callId);
        const toRemove = participants.find(
          (p) => p.userId === userId && p.device === device,
        );
        if (toRemove) {
          await this.redis!.srem(key, JSON.stringify(toRemove));
        }
      },
      () => {
        const key = `call:${callId}:participants`;
        const participants = this.mockData.get(key) || [];
        const filtered = participants.filter(
          (p) => !(p.userId === userId && p.device === device),
        );
        this.mockData.set(key, filtered);
        this.logger.log(
          `👥 Removed participant from call ${callId}: ${userId} (${device})`,
        );
      },
    );
  }

  async clearCallData(callId: string): Promise<void> {
    const statusKey = `call:${callId}:status`;
    const participantsKey = `call:${callId}:participants`;
    this.mockData.delete(statusKey);
    this.mockData.delete(participantsKey);
  }
}
