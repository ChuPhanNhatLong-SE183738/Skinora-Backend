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

    console.log('=== AGORA SERVICE INITIALIZATION ===');
    console.log('App ID configured:', !!this.appId);
    console.log('App ID length:', this.appId?.length);
    console.log(
      'App ID preview:',
      this.appId ? this.appId.substring(0, 8) + '...' : 'NOT SET',
    );
    console.log('App Certificate configured:', !!this.appCertificate);
    console.log('App Certificate length:', this.appCertificate?.length);
    console.log(
      'App Certificate preview:',
      this.appCertificate
        ? this.appCertificate.substring(0, 8) + '...'
        : 'NOT SET',
    );

    // Additional debug info
    console.log('🔍 AGORA PROJECT VALIDATION:');
    console.log('Expected App ID format: 32 hex characters');
    console.log('Expected Certificate format: 32 hex characters');
    console.log('Current App ID from env:', this.appId);
    console.log('Current Certificate from env:', this.appCertificate);

    // Check if values look like valid Agora credentials
    const appIdValid = this.appId && /^[a-f0-9]{32}$/i.test(this.appId);
    const certValid =
      this.appCertificate && /^[a-f0-9]{32}$/i.test(this.appCertificate);

    console.log('App ID format valid:', appIdValid);
    console.log('Certificate format valid:', certValid);

    if (!appIdValid) {
      console.log('❌ App ID should be 32 hex characters (0-9, a-f)');
      console.log('💡 Go to Agora Console → Project Management → Basic Info');
    }

    if (!certValid) {
      console.log('❌ App Certificate should be 32 hex characters (0-9, a-f)');
      console.log(
        '💡 Go to Agora Console → Project Management → Features → Primary Certificate',
      );
    }

    console.log('===================================');

    if (!this.appId) {
      this.logger.error(
        '❌ AGORA_APP_ID not configured - Please set in environment variables',
      );
    } else if (this.appId.length !== 32) {
      this.logger.error(
        `❌ AGORA_APP_ID invalid length: ${this.appId.length}, expected: 32`,
      );
    } else if (!appIdValid) {
      this.logger.error(
        '❌ AGORA_APP_ID invalid format - should be 32 hex characters',
      );
    }

    if (!this.appCertificate) {
      this.logger.error(
        '❌ AGORA_APP_CERTIFICATE not configured - Please set in environment variables',
      );
    } else if (this.appCertificate.length !== 32) {
      this.logger.error(
        `❌ AGORA_APP_CERTIFICATE invalid length: ${this.appCertificate.length}, expected: 32`,
      );
    } else if (!certValid) {
      this.logger.error(
        '❌ AGORA_APP_CERTIFICATE invalid format - should be 32 hex characters',
      );
    }

    // Test configuration
    this.testConfiguration();
  }

  private testConfiguration(): void {
    try {
      if (this.isConfigured()) {
        // Test token generation with dummy data
        const testChannel = 'test_channel_123';
        const testUid = 12345;

        console.log('🧪 Testing Agora configuration...');
        const testToken = this.generateTestToken(testChannel, testUid);

        if (testToken && testToken.length > 100) {
          this.logger.log('✅ Agora configuration test passed');
          console.log('✅ Sample token generated successfully');
          console.log('   Length:', testToken.length);
          console.log('   Preview:', testToken.substring(0, 30) + '...');
        } else {
          this.logger.error(
            '❌ Agora configuration test failed - token too short',
          );
        }
      } else {
        this.logger.error(
          '❌ Agora configuration incomplete - missing credentials',
        );
        console.log('📋 Configuration Checklist:');
        console.log('1. Go to Agora Console (console.agora.io)');
        console.log('2. Select your project');
        console.log('3. Go to Project Management → Basic Info');
        console.log('4. Copy App ID (32 hex characters)');
        console.log('5. Go to Features → Primary Certificate');
        console.log('6. Enable and copy Certificate (32 hex characters)');
        console.log('7. Add both to your .env file');
      }
    } catch (error) {
      this.logger.error('❌ Agora configuration test failed:', error.message);
      console.log('🔧 Debug suggestions:');
      console.log('- Verify App ID and Certificate are correct');
      console.log('- Check if Primary Certificate is enabled in Agora Console');
      console.log('- Ensure project is RTC (not Chat) enabled');
    }
  }

  private generateTestToken(channelName: string, uid: number): string {
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTimeInSeconds = currentTime + 24 * 60 * 60;
    const rtcRole = RtcRole.PUBLISHER;

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      rtcRole,
      expirationTimeInSeconds,
    );
  }

  generateRtcToken(
    channelName: string,
    uid: number,
    role: string = 'publisher',
  ): string {
    if (!this.isConfigured()) {
      throw new Error(
        '❌ Agora service is not properly configured - check App ID and Certificate',
      );
    }

    try {
      // Validate inputs
      this.validateInputs(channelName, uid);

      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTimeInSeconds = currentTime + 24 * 60 * 60;
      const rtcRole = RtcRole.PUBLISHER;

      console.log('=== AGORA TOKEN GENERATION ===');
      console.log('🔧 Configuration Check:');
      console.log('  App ID:', this.appId.substring(0, 8) + '...');
      console.log(
        '  App Certificate:',
        this.appCertificate.substring(0, 8) + '...',
      );
      console.log('📡 Channel Info:');
      console.log('  Channel Name:', channelName);
      console.log('  UID:', uid);
      console.log('  Role:', rtcRole);
      console.log('⏰ Time Info:');
      console.log('  Current Unix:', currentTime);
      console.log('  Expiration Unix:', expirationTimeInSeconds);
      console.log('  Current Time:', new Date().toISOString());
      console.log(
        '  Expiration Time:',
        new Date(expirationTimeInSeconds * 1000).toISOString(),
      );
      console.log(
        '  Valid for (hours):',
        (expirationTimeInSeconds - currentTime) / 3600,
      );

      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        rtcRole,
        expirationTimeInSeconds,
      );

      if (!token) {
        throw new Error('❌ RtcTokenBuilder returned empty token');
      }

      console.log('✅ Token Generated Successfully:');
      console.log('  Length:', token.length);
      console.log('  Prefix:', token.substring(0, 20) + '...');
      console.log('  Suffix:', '...' + token.substring(token.length - 20));
      console.log('=============================');

      // Additional validation
      this.validateGeneratedToken(token);

      return token;
    } catch (error) {
      console.error('=== AGORA TOKEN GENERATION ERROR ===');
      console.error('❌ Error Type:', error.constructor.name);
      console.error('❌ Error Message:', error.message);
      console.error('❌ Stack Trace:', error.stack);
      console.error('🔧 Debug Info:');
      console.error('  App ID Set:', !!this.appId);
      console.error('  App Certificate Set:', !!this.appCertificate);
      console.error('  Channel Name:', channelName);
      console.error('  UID:', uid);
      console.error('==================================');
      throw new Error(`Failed to generate Agora token: ${error.message}`);
    }
  }

  private validateInputs(channelName: string, uid: number): void {
    if (!channelName || channelName.trim() === '') {
      throw new Error('Channel name cannot be empty');
    }

    if (channelName.length > 64) {
      throw new Error('Channel name cannot exceed 64 characters');
    }

    // Check for invalid characters
    const validChannelRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validChannelRegex.test(channelName)) {
      throw new Error(
        'Channel name contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed',
      );
    }

    if (uid < 0 || uid > 2147483647) {
      throw new Error('UID must be between 0 and 2147483647');
    }
  }

  private validateGeneratedToken(token: string): void {
    if (token.length < 100) {
      throw new Error('Generated token seems too short - might be invalid');
    }

    // Basic token format validation
    if (!token.startsWith('006') && !token.startsWith('007')) {
      console.warn(
        '⚠️ Warning: Token does not start with expected prefix (006 or 007)',
      );
    }
  }

  // Add method to validate token
  validateTokenExpiration(token: string): boolean {
    try {
      // Simple validation - check if token format is correct
      if (!token || token.length < 50) {
        return false;
      }

      // Token should start with proper format
      if (!token.startsWith('006') && !token.startsWith('007')) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  // Generate token with custom expiration
  generateLongLivedToken(
    channelName: string,
    uid: number,
    hoursValid: number = 24,
  ): string {
    if (!this.isConfigured()) {
      throw new Error('Agora service is not properly configured');
    }

    const expirationTimeInSeconds =
      Math.floor(Date.now() / 1000) + hoursValid * 60 * 60;
    const rtcRole = RtcRole.PUBLISHER;

    console.log(
      `Generating ${hoursValid}-hour token for channel: ${channelName}, uid: ${uid}`,
    );

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      rtcRole,
      expirationTimeInSeconds,
    );
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

  // Enhanced configuration check
  isConfigured(): boolean {
    const hasAppId = !!(this.appId && this.appId.length === 32);
    const hasCertificate = !!(
      this.appCertificate && this.appCertificate.length === 32
    );

    if (!hasAppId) {
      console.error('❌ Invalid App ID configuration');
    }
    if (!hasCertificate) {
      console.error('❌ Invalid App Certificate configuration');
    }

    return hasAppId && hasCertificate;
  }

  // Add method to get configuration status
  getConfigurationStatus(): any {
    return {
      configured: this.isConfigured(),
      appIdSet: !!this.appId,
      appIdLength: this.appId?.length || 0,
      appCertificateSet: !!this.appCertificate,
      appCertificateLength: this.appCertificate?.length || 0,
      appIdPreview: this.appId ? this.appId.substring(0, 8) + '...' : 'NOT SET',
      recommendedActions: this.getRecommendedActions(),
    };
  }

  private getRecommendedActions(): string[] {
    const actions: string[] = [];

    if (!this.appId) {
      actions.push('Set AGORA_APP_ID in environment variables');
    } else if (this.appId.length !== 32) {
      actions.push('Check AGORA_APP_ID length (should be 32 characters)');
    }

    if (!this.appCertificate) {
      actions.push('Set AGORA_APP_CERTIFICATE in environment variables');
    } else if (this.appCertificate.length !== 32) {
      actions.push(
        'Check AGORA_APP_CERTIFICATE length (should be 32 characters)',
      );
    }

    if (actions.length === 0) {
      actions.push('Configuration looks good! ✅');
    }

    return actions;
  }

  // Add method to validate current system time
  validateSystemTime(): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const year2020 = Math.floor(new Date('2020-01-01').getTime() / 1000);
    const year2030 = Math.floor(new Date('2030-01-01').getTime() / 1000);

    console.log('=== SYSTEM TIME VALIDATION ===');
    console.log('Current Unix timestamp:', currentTime);
    console.log('Current time (readable):', new Date().toISOString());
    console.log(
      'Is time reasonable?',
      currentTime > year2020 && currentTime < year2030,
    );
    console.log('============================');

    return currentTime > year2020 && currentTime < year2030;
  }

  // Generate token with explicit validation
  generateValidatedToken(
    channelName: string,
    uid: number,
    hoursValid: number = 24,
  ): string {
    console.log('=== VALIDATED TOKEN GENERATION ===');

    // Validate system time first
    if (!this.validateSystemTime()) {
      throw new Error(
        'System time appears to be incorrect - this can cause token validation issues',
      );
    }

    // Validate Agora configuration
    if (!this.appId || this.appId.length !== 32) {
      throw new Error('Invalid Agora App ID - must be 32 characters');
    }

    if (!this.appCertificate || this.appCertificate.length !== 32) {
      throw new Error('Invalid Agora App Certificate - must be 32 characters');
    }

    // Clean channel name
    const cleanChannelName = channelName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanChannelName !== channelName) {
      console.warn(
        `Channel name cleaned: "${channelName}" -> "${cleanChannelName}"`,
      );
    }

    // Generate token
    const token = this.generateRtcToken(cleanChannelName, uid);

    // Validate generated token
    if (!this.validateTokenExpiration(token)) {
      throw new Error('Generated token failed validation');
    }

    console.log('Token validation successful');
    console.log('==============================');

    return token;
  }

  // Add method to verify Agora project settings
  async verifyAgoraProject(): Promise<any> {
    const status = {
      configured: this.isConfigured(),
      appIdValid: this.appId && /^[a-f0-9]{32}$/i.test(this.appId),
      certificateValid:
        this.appCertificate && /^[a-f0-9]{32}$/i.test(this.appCertificate),
      testTokenGeneration: false,
      recommendations: [] as string[],
    };

    // Test token generation
    if (status.configured) {
      try {
        const testToken = this.generateTestToken('test_123', 12345);
        status.testTokenGeneration = !!(testToken && testToken.length > 100);
      } catch (error) {
        status.testTokenGeneration = false;
        status.recommendations.push(
          `Token generation failed: ${error.message}`,
        );
      }
    }

    // Add recommendations
    if (!status.appIdValid) {
      status.recommendations.push('Check App ID format (32 hex characters)');
    }
    if (!status.certificateValid) {
      status.recommendations.push(
        'Check App Certificate format (32 hex characters)',
      );
    }
    if (!status.testTokenGeneration && status.configured) {
      status.recommendations.push(
        'Enable Primary Certificate in Agora Console',
      );
    }

    return status;
  }

  // Add comprehensive token debugging
  debugTokenGeneration(channelName: string, uid: number): any {
    console.log('=== AGORA TOKEN DEBUG ===');

    const debugInfo = {
      inputs: { channelName, uid },
      configuration: {
        appId: this.appId,
        appIdLength: this.appId?.length,
        appIdValid: !!(this.appId && /^[a-f0-9]{32}$/i.test(this.appId)),
        certificateLength: this.appCertificate?.length,
        certificateValid: !!(
          this.appCertificate && /^[a-f0-9]{32}$/i.test(this.appCertificate)
        ),
      },
      timing: {
        currentUnix: Math.floor(Date.now() / 1000),
        currentISO: new Date().toISOString(),
      },
      tokenGeneration: {
        success: false,
        token: null as string | null,
        tokenLength: 0,
        tokenPrefix: '',
        tokenSuffix: '',
        error: null as string | null,
      },
    };

    try {
      // Validate inputs first
      this.validateInputs(channelName, uid);

      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTimeInSeconds = currentTime + 1 * 60 * 60; // 1 hour
      const rtcRole = RtcRole.PUBLISHER;

      console.log('Generating token with:');
      console.log('- App ID:', this.appId);
      console.log(
        '- Certificate:',
        this.appCertificate.substring(0, 8) + '...',
      );
      console.log('- Channel:', channelName);
      console.log('- UID:', uid);
      console.log('- Role:', rtcRole);
      console.log('- Expiration Unix:', expirationTimeInSeconds);
      console.log(
        '- Expiration ISO:',
        new Date(expirationTimeInSeconds * 1000).toISOString(),
      );

      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        rtcRole,
        expirationTimeInSeconds,
      );

      if (!token) {
        throw new Error('RtcTokenBuilder returned null/empty token');
      }

      debugInfo.tokenGeneration = {
        success: true,
        token: token,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20),
        tokenSuffix: token.substring(token.length - 20),
        error: null,
      };

      console.log('✅ Token generated successfully');
      console.log('Length:', token.length);
      console.log('Preview:', token.substring(0, 50) + '...');
    } catch (error) {
      console.error('❌ Token generation failed:', error);
      debugInfo.tokenGeneration.error = error.message;
    }

    console.log('========================');
    return debugInfo;
  }

  // Validate Agora credentials against their requirements
  validateAgoraCredentials(): any {
    const validation = {
      appId: {
        exists: !!this.appId,
        length: this.appId?.length || 0,
        format: 'INVALID',
        value: this.appId || 'NOT_SET',
      },
      certificate: {
        exists: !!this.appCertificate,
        length: this.appCertificate?.length || 0,
        format: 'INVALID',
        value: this.appCertificate
          ? this.appCertificate.substring(0, 8) + '...'
          : 'NOT_SET',
      },
      overall: 'INVALID',
    };

    // Validate App ID
    if (this.appId) {
      if (this.appId.length === 32 && /^[a-f0-9]{32}$/i.test(this.appId)) {
        validation.appId.format = 'VALID';
      } else if (this.appId.length === 32) {
        validation.appId.format = 'WRONG_CHARACTERS';
      } else {
        validation.appId.format = 'WRONG_LENGTH';
      }
    }

    // Validate Certificate
    if (this.appCertificate) {
      if (
        this.appCertificate.length === 32 &&
        /^[a-f0-9]{32}$/i.test(this.appCertificate)
      ) {
        validation.certificate.format = 'VALID';
      } else if (this.appCertificate.length === 32) {
        validation.certificate.format = 'WRONG_CHARACTERS';
      } else {
        validation.certificate.format = 'WRONG_LENGTH';
      }
    }

    // Overall validation
    if (
      validation.appId.format === 'VALID' &&
      validation.certificate.format === 'VALID'
    ) {
      validation.overall = 'VALID';
    }

    return validation;
  }

  // Validate token parameters against client requirements
  validateTokenParameters(
    channelName: string,
    uid: number,
    frontendChannelName: string,
    frontendUid: number,
  ): any {
    const validation = {
      channelNameMatch: channelName === frontendChannelName,
      uidMatch: uid === frontendUid,
      channelNameValid: this.validateChannelName(channelName),
      uidValid: this.validateUid(uid),
      overall: 'INVALID',
    };

    if (
      validation.channelNameMatch &&
      validation.uidMatch &&
      validation.channelNameValid &&
      validation.uidValid
    ) {
      validation.overall = 'VALID';
    }

    return validation;
  }

  private validateChannelName(channelName: string): boolean {
    if (!channelName || channelName.trim() === '') return false;
    if (channelName.length > 64) return false;
    return /^[a-zA-Z0-9_-]+$/.test(channelName);
  }

  private validateUid(uid: number): boolean {
    return uid >= 0 && uid <= 2147483647;
  }

  // Generate token with exact expiration validation
  generateTokenWithExactExpiration(
    channelName: string,
    uid: number,
    expirationHours: number = 24,
  ): any {
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = currentTime + expirationHours * 60 * 60;

    console.log('=== EXACT TOKEN GENERATION ===');
    console.log('Current Unix Time:', currentTime);
    console.log('Expiration Unix Time:', expirationTime);
    console.log('Current ISO:', new Date().toISOString());
    console.log(
      'Expiration ISO:',
      new Date(expirationTime * 1000).toISOString(),
    );
    console.log('Hours Valid:', expirationHours);
    console.log('Time Diff (seconds):', expirationTime - currentTime);
    console.log('==============================');

    // Check if expiration is in future
    if (expirationTime <= currentTime) {
      throw new Error('Expiration time must be in the future');
    }

    const rtcRole = RtcRole.PUBLISHER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      rtcRole,
      expirationTime,
    );

    return {
      token,
      channelName,
      uid,
      role: rtcRole,
      currentTime,
      expirationTime,
      currentISO: new Date().toISOString(),
      expirationISO: new Date(expirationTime * 1000).toISOString(),
      hoursValid: expirationHours,
      isExpired: expirationTime <= Math.floor(Date.now() / 1000),
      timeUntilExpiry: expirationTime - Math.floor(Date.now() / 1000),
    };
  }
}
