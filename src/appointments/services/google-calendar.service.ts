import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleCalendarService implements OnModuleInit {
  private calendar: calendar_v3.Calendar;
  private oAuth2Client: OAuth2Client;
  private readonly logger = new Logger(GoogleCalendarService.name);
  private isConfigured = false;
  private configAttempted = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeCalendarClient();
  }

  private initializeCalendarClient() {
    this.configAttempted = true;
    
    try {
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
      const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');
      const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

      // Log the credentials (without revealing sensitive data)
      this.logger.log(`Google Calendar configuration check:
        CLIENT_ID: ${clientId ? 'Provided' : 'Missing'}
        CLIENT_SECRET: ${clientSecret ? 'Provided' : 'Missing'}
        REDIRECT_URI: ${redirectUri ? 'Provided' : 'Missing'}
        REFRESH_TOKEN: ${refreshToken ? 'Provided' : 'Missing'}`);

      // Check if all required credentials are present
      if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
        this.logger.warn('Google Calendar credentials not properly configured. Meet link generation will be disabled.');
        return;
      }

      // Initialize OAuth2 client
      this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      // Set credentials
      this.oAuth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Initialize Calendar API client
      this.calendar = google.calendar({
        version: 'v3',
        auth: this.oAuth2Client
      });

      this.isConfigured = true;
      this.logger.log('Google Calendar service initialized successfully');
      
      // Perform a test API call to validate configuration
      this.testConnection();
    } catch (error) {
      this.logger.error(`Failed to initialize Google Calendar service: ${error.message}`);
    }
  }
  
  /**
   * Validates the OAuth connection with a simple API call
   */
  private async testConnection() {
    try {
      await this.calendar.calendarList.list({ maxResults: 1 });
      this.logger.log('Google Calendar API connection test successful');
    } catch (error) {
      this.isConfigured = false;
      this.logger.error(`Google Calendar API connection test failed: ${error.message}`);
      if (error.message.includes('invalid_client')) {
        this.logger.error('Client ID or Secret is invalid. Check your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET values.');
      } else if (error.message.includes('invalid_grant')) {
        this.logger.error('Refresh token is invalid or expired. Generate a new GOOGLE_REFRESH_TOKEN.');
      }
    }
  }

  /**
   * Creates a Google Calendar event with a Google Meet link
   */
  async createMeetingLink(
    summary: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendees: { email: string }[],
  ): Promise<{ eventId: string, meetLink: string }> {
    // If config hasn't been attempted yet, try initializing
    if (!this.configAttempted) {
      this.initializeCalendarClient();
    }
    
    // If not properly configured, fail early with clear message
    if (!this.isConfigured) {
      throw new Error('Google Calendar service not properly configured');
    }

    try {
      const event = {
        summary,
        description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `skinora-meeting-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        }
      };

      // Log OAuth status before making the API call
      this.logger.log(`Attempting to create calendar event with OAuth client: ${!!this.oAuth2Client}`);
      
      try {
        const response = await this.calendar.events.insert({
          calendarId: 'primary', // or a specific calendar ID
          requestBody: event,
          conferenceDataVersion: 1, // Required for Meet link generation
        });

        if (!response.data.hangoutLink) {
          this.logger.error('Failed to generate Meet link');
          throw new Error('Failed to generate Google Meet link');
        }

        this.logger.log(`Successfully created Google Calendar event with ID: ${response.data.id}`);
        
        return {
          eventId: response.data.id as string,
          meetLink: response.data.hangoutLink as string,
        };
      } catch (error) {
        if (error.message.includes('invalid_client')) {
          this.logger.error(`OAuth client authentication failed: please check your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET`);
          this.isConfigured = false; // Mark as misconfigured to prevent further attempts
        } else if (error.message.includes('invalid_grant')) {
          this.logger.error(`OAuth token error: your GOOGLE_REFRESH_TOKEN may be expired or invalid`);
          this.isConfigured = false; // Mark as misconfigured to prevent further attempts
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to create Google Calendar event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates an existing Google Calendar event
   */
  async updateMeeting(
    eventId: string,
    summary?: string,
    description?: string,
    startTime?: Date,
    endTime?: Date,
    attendees?: { email: string }[],
  ) {
    // If not properly configured, fail early
    if (!this.isConfigured) {
      throw new Error('Google Calendar service not properly configured');
    }

    try {
      const event: any = {};
      
      if (summary) event.summary = summary;
      if (description) event.description = description;
      if (startTime) event.start = { dateTime: startTime.toISOString(), timeZone: 'UTC' };
      if (endTime) event.end = { dateTime: endTime.toISOString(), timeZone: 'UTC' };
      if (attendees) event.attendees = attendees;

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update Google Calendar event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancels a Google Calendar event
   */
  async cancelMeeting(eventId: string) {
    // If not properly configured, fail early
    if (!this.isConfigured) {
      throw new Error('Google Calendar service not properly configured');
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel Google Calendar event: ${error.message}`);
      throw error;
    }
  }
}
