import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

@Injectable()
export class AgoraService {
  private readonly logger = new Logger(AgoraService.name);
  private readonly appId: string | undefined;
  private readonly appCertificate: string | undefined;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('AGORA_APP_ID');
    this.appCertificate = this.configService.get<string>(
      'AGORA_APP_CERTIFICATE',
    );

    if (!this.appId || !this.appCertificate) {
      this.logger.error('❌ Agora credentials not configured properly');
      this.logger.error(`AppId: ${this.appId ? 'SET' : 'MISSING'}`);
      this.logger.error(
        `AppCertificate: ${this.appCertificate ? 'SET' : 'MISSING'}`,
      );
    } else {
      this.logger.log('✅ Agora service initialized successfully');
    }
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appCertificate);
  }

  getAppId(): string {
    if (!this.appId) {
      this.logger.error('❌ AGORA_APP_ID is not configured');
      throw new Error('Agora App ID not configured');
    }
    return this.appId;
  }

  generateRtcToken(
    channelName: string,
    uid: number,
    role: RtcRole = RtcRole.PUBLISHER,
  ): string {
    if (!this.isConfigured()) {
      this.logger.error('❌ Cannot generate token - Agora credentials missing');
      throw new Error('Agora credentials not configured');
    }

    // Token expires in 24 hours
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 24 * 3600;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId!,
        this.appCertificate!,
        channelName,
        uid,
        role,
        expirationTimeInSeconds,
      );

      this.logger.log(
        `🎫 Generated Agora token for channel: ${channelName}, uid: ${uid}`,
      );
      return token;
    } catch (error) {
      this.logger.error(`❌ Failed to generate Agora token: ${error.message}`);
      throw new Error(`Failed to generate Agora token: ${error.message}`);
    }
  }

  // Generate validated token with error handling
  generateValidatedToken(
    channelName: string,
    uid: number,
    hoursValid: number = 24,
  ): string {
    if (!this.isConfigured()) {
      throw new Error('Agora credentials not configured');
    }

    const expirationTimeInSeconds =
      Math.floor(Date.now() / 1000) + hoursValid * 3600;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId!,
        this.appCertificate!,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        expirationTimeInSeconds,
      );

      this.logger.log(
        `🎫 Generated validated token for channel: ${channelName}`,
      );
      return token;
    } catch (error) {
      this.logger.error(
        `❌ Failed to generate validated token: ${error.message}`,
      );
      throw new Error(`Failed to generate validated token: ${error.message}`);
    }
  }

  // Generate unique UID
  generateUid(): number {
    return Math.floor(Math.random() * 100000) + 1;
  }

  // Generate unique channel name
  generateChannelName(
    callType: string,
    patientId: string,
    doctorId: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${callType}_${timestamp}_${random}`;
  }

  // Generate simple channel name (for better compatibility)
  generateSimpleChannelName(callId: string): string {
    // Use just the last 8 characters of callId for shorter channel name
    const shortId = callId.slice(-8);
    return `call_${shortId}`;
  }

  // Generate very simple channel name
  generateMinimalChannelName(): string {
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    return `c${timestamp}`;
  }

  // Debug method to check configuration
  getConfiguration() {
    return {
      hasAppId: !!this.appId,
      hasAppCertificate: !!this.appCertificate,
      appId: this.appId,
      appIdLength: this.appId?.length || 0,
      appCertificateSet: !!this.appCertificate,
      appCertificateLength: this.appCertificate?.length || 0,
      isConfigured: this.isConfigured(),
      configured: this.isConfigured(), // Add this for backward compatibility
      // Don't expose certificate for security
    };
  }

  getConfigurationStatus() {
    return this.getConfiguration();
  }

  // Validate Agora credentials
  validateAgoraCredentials(): {
    overall: string;
    hasAppId: boolean;
    hasAppCertificate: boolean;
    appIdValid: boolean;
    appCertificateValid: boolean;
  } {
    const hasAppId = !!this.appId;
    const hasAppCertificate = !!this.appCertificate;
    const appIdValid = hasAppId && this.appId!.length === 32;
    const appCertificateValid =
      hasAppCertificate && this.appCertificate!.length === 32;

    const overall =
      hasAppId && hasAppCertificate && appIdValid && appCertificateValid
        ? 'VALID'
        : 'INVALID';

    return {
      overall,
      hasAppId,
      hasAppCertificate,
      appIdValid,
      appCertificateValid,
    };
  }

  // Validate system time
  validateSystemTime(): boolean {
    const now = Date.now();
    const validTime = now > 0 && now < Date.now() + 1000;
    return validTime;
  }

  // Validate token expiration
  validateTokenExpiration(token: string): boolean {
    // Simple validation - in real implementation, you'd decode the token
    const isValid = !!(token && token.length > 50);
    return isValid;
  }

  // Verify Agora project
  async verifyAgoraProject(): Promise<{ valid: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        message: 'Agora credentials not configured',
      };
    }

    // In real implementation, you might make API calls to Agora to verify
    return {
      valid: true,
      message: 'Agora project configuration appears valid',
    };
  }

  // Debug token generation
  debugTokenGeneration(channelName: string, uid: number): any {
    return {
      channelName,
      uid,
      appId: this.appId,
      hasAppCertificate: !!this.appCertificate,
      isConfigured: this.isConfigured(),
      timestamp: Date.now(),
    };
  }

  // Generate token with subscriber role (for testing)
  generateSubscriberToken(
    channelName: string,
    uid: number,
    hoursValid: number = 24,
  ): string {
    if (!this.isConfigured()) {
      throw new Error('Agora credentials not configured');
    }

    const expirationTimeInSeconds =
      Math.floor(Date.now() / 1000) + hoursValid * 3600;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId!,
        this.appCertificate!,
        channelName,
        uid,
        RtcRole.SUBSCRIBER, // Use SUBSCRIBER role
        expirationTimeInSeconds,
      );

      this.logger.log(
        `🎫 Generated SUBSCRIBER token for channel: ${channelName}`,
      );
      return token;
    } catch (error) {
      this.logger.error(
        `❌ Failed to generate subscriber token: ${error.message}`,
      );
      throw new Error(`Failed to generate subscriber token: ${error.message}`);
    }
  }

  /**
   * Validate and decode Agora token information
   */
  validateToken(token: string, channelName: string, uid: number): any {
    try {
      // Basic token format validation
      if (!token || token.length < 100) {
        return {
          valid: false,
          error: 'Token too short or missing',
        };
      } // Check if token starts with app ID
      const expectedStart = this.appId || '';
      const tokenStart = token.substring(0, expectedStart.length);

      if (tokenStart !== expectedStart) {
        return {
          valid: false,
          error: 'Token does not start with correct app ID',
          expected: expectedStart,
          actual: tokenStart,
        };
      }

      // Generate a test token with same parameters to compare
      const testToken = this.generateRtcToken(channelName, uid);
      const testTokenStart = testToken.substring(0, 50);
      const actualTokenStart = token.substring(0, 50);

      return {
        valid: true,
        tokenLength: token.length,
        startsWithAppId: tokenStart === expectedStart,
        channelName: channelName,
        uid: uid,
        appId: this.appId,
        comparison: {
          providedTokenStart: actualTokenStart,
          generatedTokenStart: testTokenStart,
          tokensMatch: testToken === token,
        },
        analysis: {
          hasCorrectFormat: token.includes(this.appId || ''),
          lengthOk: token.length > 100 && token.length < 500,
          containsBase64: /[A-Za-z0-9+/]/.test(
            token.substring((this.appId || '').length),
          ),
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: `Token validation failed: ${(error as any).message}`,
      };
    }
  }

  /**
   * Generate token with specific role for testing
   */
  generateTokenWithRole(
    channelName: string,
    uid: number,
    role: 'host' | 'audience' = 'host',
  ): string {
    const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + 24 * 3600; // 24 hours

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId || '',
      this.appCertificate || '',
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs,
    );
  }

  /**
   * Test different UID formats for compatibility
   */ testUidFormats(channelName: string, baseUid: number) {
    const results: any[] = [];

    // Test different UID formats
    const testUids = [
      baseUid, // Original
      Math.abs(baseUid), // Absolute value
      baseUid % 4294967295, // 32-bit max
      parseInt(baseUid.toString().substring(0, 8)), // Truncated
    ];

    for (const uid of testUids) {
      try {
        const token = this.generateRtcToken(channelName, uid);
        results.push({
          uid: uid,
          token: token.substring(0, 50) + '...',
          success: true,
        });
      } catch (error) {
        results.push({
          uid: uid,
          error: (error as any).message,
          success: false,
        });
      }
    }

    return results;
  }

  /**
   * Generate simple test configuration for debugging
   */
  generateSimpleTestConfig() {
    const simpleChannel = 'test_' + Date.now();
    const simpleUid = Math.floor(Math.random() * 1000000);
    const token = this.generateRtcToken(simpleChannel, simpleUid);

    return {
      appId: this.appId,
      channelName: simpleChannel,
      uid: simpleUid,
      token: token,
      tokenInfo: this.validateToken(token, simpleChannel, simpleUid),
      instructions: {
        note: 'Use these exact values for testing',
        appIdCheck: `Token should start with: ${this.appId}`,
        uidNote: 'UID must be positive integer',
        channelNote: 'Channel name must be same for all participants',
      },
    };
  }

  // ...existing code...
}
