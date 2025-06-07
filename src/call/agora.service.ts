import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Import with require to avoid TypeScript issues
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

@Injectable()
export class AgoraService {
  private readonly logger = new Logger(AgoraService.name);
  private appId: string;
  private appCertificate: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get('AGORA_APP_ID') || '';
    this.appCertificate = this.configService.get('AGORA_APP_CERTIFICATE') || '';

    if (!this.appId) {
      this.logger.warn('AGORA_APP_ID not configured');
    }

    if (!this.appCertificate) {
      this.logger.warn(
        'AGORA_APP_CERTIFICATE not configured - tokens will not work',
      );
    }
  }

  generateRtcToken(
    channelName: string,
    uid: number,
    role: 'publisher' | 'subscriber' = 'publisher',
  ): string {
    if (!this.appId || !this.appCertificate) {
      this.logger.error('Agora credentials not configured properly');
      throw new Error('Agora service not configured');
    }

    try {
      const agoraRole =
        role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        agoraRole,
        privilegeExpiredTs,
      );

      this.logger.log(
        `Generated token for channel: ${channelName}, uid: ${uid}`,
      );
      return token;
    } catch (error) {
      this.logger.error('Failed to generate Agora token:', error);
      throw new Error('Failed to generate video call token');
    }
  }

  generateChannelName(callId: string): string {
    return `skinora_call_${callId}`;
  }

  generateUid(): number {
    return Math.floor(Math.random() * 100000) + 1;
  }

  getAppId(): string {
    return this.appId;
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appCertificate);
  }
}
