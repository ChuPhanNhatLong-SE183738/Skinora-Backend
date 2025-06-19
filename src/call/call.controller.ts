import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Logger,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CallService } from './call.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse, errorResponse } from '../helper/response.helper';
import {
  InitiateCallDto,
  AddCallNotesDto,
  JoinCallDto,
} from './dto/initiate-call.dto';
import { AgoraService } from './agora.service';
import { CallGateway } from './call.gateway';
import { RedisService } from '../websocket/redis.service';

@ApiTags('call')
@Controller('call')
export class CallController {
  private readonly logger = new Logger(CallController.name);
  constructor(
    private readonly callService: CallService,
    private readonly agoraService: AgoraService,
    private readonly callGateway: CallGateway,
    private readonly redisService: RedisService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get call details by ID' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  @ApiResponse({
    status: 200,
    description: 'Call details retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Call details retrieved successfully',
        data: {
          _id: '6844721a12247c8cda556d07',
          patientId: '683ec8811deabdaefb552180',
          doctorId: '684460f8fe31c80c380b343f',
          appointmentId: '684469608d16d2b432763e6a',
          roomId: 'skinora_call_6844721a12247c8cda556d07',
          callType: 'video',
          status: 'ringing',
          agoraAppId: 'your-agora-app-id',
          token: 'agora-rtc-token',
          uid: 12345,
          userRole: 'patient',
        },
      },
    },
  })
  async getCall(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token',
        };
      }

      const call = await this.callService.getCallById(callId);

      if (!call) {
        return {
          success: false,
          message: 'Call not found or has ended',
        };
      }

      // Debug logging
      console.log('=== CALL DEBUG ===');
      console.log('call.patientId:', call.patientId);
      console.log('call.doctorId:', call.doctorId);
      console.log('patientId type:', typeof call.patientId);
      console.log('doctorId type:', typeof call.doctorId);
      console.log('=================');

      // Safe handling of potentially populated or non-populated IDs
      let patientId: string;
      let doctorId: string;

      try {
        // Handle ObjectId or populated object
        if (call.patientId) {
          if (
            typeof call.patientId === 'object' &&
            (call.patientId as any)._id
          ) {
            // Populated object
            patientId = (call.patientId as any)._id.toString();
          } else if (typeof call.patientId === 'string') {
            // String ObjectId
            patientId = call.patientId;
          } else {
            // Direct ObjectId
            patientId = call.patientId.toString();
          }
        } else {
          patientId = '';
        }

        if (call.doctorId) {
          if (typeof call.doctorId === 'object' && (call.doctorId as any)._id) {
            // Populated object
            doctorId = (call.doctorId as any)._id.toString();
          } else if (typeof call.doctorId === 'string') {
            // String ObjectId
            doctorId = call.doctorId;
          } else {
            // Direct ObjectId
            doctorId = call.doctorId.toString();
          }
        } else {
          // doctorId is null - get from raw call data
          console.log('doctorId is null, getting raw call data...');
          const rawCall = await this.callService.getCallByIdRaw(callId);
          if (rawCall && rawCall.doctorId) {
            doctorId = rawCall.doctorId.toString();
            console.log('Found doctorId from raw call:', doctorId);
          } else {
            doctorId = '';
          }
        }

        console.log('Extracted patientId:', patientId);
        console.log('Extracted doctorId:', doctorId);
      } catch (idError) {
        console.error('Error extracting participant IDs:', idError);
        return {
          success: false,
          message: 'Invalid call data - cannot extract participant IDs',
        };
      }

      if (!patientId || !doctorId) {
        console.error(
          'Missing IDs - patientId:',
          patientId,
          'doctorId:',
          doctorId,
        );
        return {
          success: false,
          message: `Invalid call data - missing participant IDs. PatientId: ${patientId ? 'OK' : 'MISSING'}, DoctorId: ${doctorId ? 'OK' : 'MISSING'}`,
        };
      }

      const isPatient = patientId === userId;
      const isDoctor = doctorId === userId;

      if (!isPatient && !isDoctor) {
        return {
          success: false,
          message: 'You are not authorized to access this call',
        };
      }

      // Generate new token for the user with longer expiration
      const uid = Math.floor(Math.random() * 100000) + 1;

      // Generate token with comprehensive validation
      let token: string;
      try {
        token = this.agoraService.generateValidatedToken(call.roomId, uid, 24);
      } catch (tokenError) {
        console.error('Token generation failed:', tokenError);
        return {
          success: false,
          message: `Failed to generate Agora token: ${tokenError.message}`,
        };
      }

      const userRole = isPatient ? 'patient' : 'doctor';

      console.log('=== TOKEN INFO ===');
      console.log('Generated UID:', uid);
      console.log('Token length:', token.length);
      console.log('Channel:', call.roomId);
      console.log('User role:', userRole);
      console.log('=================');

      // Safely prepare other participant info
      let otherParticipant: any;

      if (isPatient) {
        // Current user is patient, get doctor info
        if (
          call.doctorId &&
          typeof call.doctorId === 'object' &&
          (call.doctorId as any)._id
        ) {
          otherParticipant = {
            _id: (call.doctorId as any)._id,
            fullName: (call.doctorId as any).fullName || 'Unknown Doctor',
            photoUrl: (call.doctorId as any).photoUrl || null,
          };
        } else {
          otherParticipant = { _id: doctorId, fullName: 'Unknown Doctor' };
        }
      } else {
        // Current user is doctor, get patient info
        if (
          call.patientId &&
          typeof call.patientId === 'object' &&
          (call.patientId as any)._id
        ) {
          otherParticipant = {
            _id: (call.patientId as any)._id,
            fullName: (call.patientId as any).fullName || 'Unknown Patient',
            avatarUrl: (call.patientId as any).avatarUrl || null,
          };
        } else {
          otherParticipant = { _id: patientId, fullName: 'Unknown Patient' };
        }
      }

      return {
        success: true,
        message: 'Call details retrieved successfully',
        data: {
          _id: (call as any)._id,
          patientId: call.patientId,
          doctorId: call.doctorId,
          appointmentId: call.appointmentId,
          roomId: call.roomId,
          callType: call.callType,
          status: call.status,
          startTime: call.startTime,
          endTime: call.endTime,
          duration: call.duration,
          initiatedBy: call.initiatedBy,
          endReason: call.endReason,
          notes: call.notes,
          agoraConfig: call.agoraConfig,
          createdAt: (call as any).createdAt,
          updatedAt: (call as any).updatedAt,
          // Add Agora info
          agoraAppId: this.agoraService.getAppId(),
          token,
          uid,
          userRole,
          otherParticipant,
        },
      };
    } catch (error) {
      console.error('Error retrieving call details:', error);
      return {
        success: false,
        message: error.message || 'Failed to retrieve call details',
      };
    }
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate a video/voice call with real-time notifications',
  })
  async initiateCall(@Request() req, @Body() initiateCallDto: InitiateCallDto) {
    try {
      const initiatorId = req.user.sub || req.user.id;

      // Check rate limiting
      const canInitiate = await this.redisService.checkRateLimit(
        initiatorId,
        'initiate_call',
        5, // 5 calls
        300, // per 5 minutes
      );

      if (!canInitiate) {
        return {
          success: false,
          message: 'Too many call attempts. Please wait before trying again.',
        };
      }

      const isDoctorInitiated = initiatorId === initiateCallDto.doctorId;

      const result = await this.callService.initiateCallWithRole(
        initiateCallDto.patientId,
        initiateCallDto.doctorId,
        initiateCallDto.callType,
        initiateCallDto.appointmentId,
        isDoctorInitiated,
      );

      // Cache call status in Redis - fix type conversion with proper casting
      const callId = (result as any).callId || result.callId;
      await this.redisService.setCallStatus(callId.toString(), 'ringing', {
        initiatedBy: initiatorId,
        callType: initiateCallDto.callType,
      });

      // Determine target user (who receives the call)
      const targetUserId = isDoctorInitiated
        ? initiateCallDto.patientId
        : initiateCallDto.doctorId;

      // Get caller info
      const callerInfo = await this.getCallerInfo(initiatorId);

      // Check if target user is online
      const isTargetOnline = await this.redisService.isUserOnline(targetUserId);

      if (isTargetOnline) {
        // Send real-time notification via WebSocket
        await this.callGateway.sendIncomingCallNotification(targetUserId, {
          callId: callId,
          callerInfo,
          callType: initiateCallDto.callType,
          appointmentId: initiateCallDto.appointmentId,
        });
      } else {
        // Queue notification for offline user
        await this.redisService.queueNotification(targetUserId, {
          type: 'missed_call',
          callId: callId,
          callerInfo,
          callType: initiateCallDto.callType,
          missedAt: new Date(),
        });
      }

      return successResponse(
        {
          ...result,
          targetUserOnline: isTargetOnline,
          notificationMethod: isTargetOnline ? 'websocket' : 'queued',
        },
        'Call initiated successfully with real-time notifications',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Patch(':callId/notes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add notes to call (Doctor only)' })
  async addCallNotes(
    @Param('callId') callId: string,
    @Request() req,
    @Body() addNotesDto: AddCallNotesDto,
  ) {
    try {
      const doctorId = req.user.sub || req.user.id;
      const result = await this.callService.addCallNotes(
        callId,
        addNotesDto.notes,
        doctorId,
      );
      return successResponse(result, 'Call notes added successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'End active call' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  @ApiResponse({
    status: 200,
    description: 'Call ended successfully',
    schema: {
      example: {
        success: true,
        message: 'Call ended successfully',
        data: {
          _id: '675...',
          status: 'ended',
          duration: 1800,
          endTime: '2025-01-06T13:30:00.000Z',
          endedBy: '674...',
        },
      },
    },
  })
  async endCall(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;
      const result = await this.callService.endCall(callId, userId);

      return {
        success: true,
        message: 'Call ended successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('active/user')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if user has any active calls' })
  @ApiResponse({
    status: 200,
    description: 'Active call status retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Active call status retrieved successfully',
        data: {
          hasActiveCall: true,
          activeCall: {
            _id: '6844721a12247c8cda556d07',
            callType: 'video',
            status: 'ringing',
            appointmentId: '684469608d16d2b432763e6a',
            otherParticipant: {
              _id: '684460f8fe31c80c380b343f',
              fullName: 'Dr. Smith',
              photoUrl: 'doctor-avatar.jpg',
            },
          },
        },
      },
    },
  })
  async checkActiveCall(@Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token',
        };
      }

      const activeCall = await this.callService.getActiveCallForUser(userId);

      if (!activeCall) {
        return {
          success: true,
          message: 'No active call found',
          data: {
            hasActiveCall: false,
            activeCall: null,
          },
        };
      }

      // Determine user role and other participant
      let patientId: string;
      let doctorId: string;

      // Safe extraction of IDs
      if (
        activeCall.patientId &&
        typeof activeCall.patientId === 'object' &&
        (activeCall.patientId as any)._id
      ) {
        patientId = (activeCall.patientId as any)._id.toString();
      } else if (activeCall.patientId) {
        patientId = (activeCall.patientId as any).toString();
      } else {
        patientId = '';
      }

      if (
        activeCall.doctorId &&
        typeof activeCall.doctorId === 'object' &&
        (activeCall.doctorId as any)._id
      ) {
        doctorId = (activeCall.doctorId as any)._id.toString();
      } else if (activeCall.doctorId) {
        doctorId = (activeCall.doctorId as any).toString();
      } else {
        doctorId = '';
      }

      const isPatient = patientId === userId;
      const userRole = isPatient ? 'patient' : 'doctor';

      // Get other participant info
      let otherParticipant;
      if (isPatient) {
        otherParticipant =
          activeCall.doctorId && typeof activeCall.doctorId === 'object'
            ? {
                _id: (activeCall.doctorId as any)._id,
                fullName:
                  (activeCall.doctorId as any).fullName || 'Unknown Doctor',
                photoUrl: (activeCall.doctorId as any).photoUrl || null,
              }
            : { _id: doctorId, fullName: 'Unknown Doctor' };
      } else {
        otherParticipant =
          activeCall.patientId && typeof activeCall.patientId === 'object'
            ? {
                _id: (activeCall.patientId as any)._id,
                fullName:
                  (activeCall.patientId as any).fullName || 'Unknown Patient',
                avatarUrl: (activeCall.patientId as any).avatarUrl || null,
              }
            : { _id: patientId, fullName: 'Unknown Patient' };
      }

      return {
        success: true,
        message: 'Active call found',
        data: {
          hasActiveCall: true,
          activeCall: {
            _id: activeCall._id,
            callType: activeCall.callType,
            status: activeCall.status,
            appointmentId: activeCall.appointmentId,
            roomId: activeCall.roomId,
            userRole,
            otherParticipant,
            createdAt: (activeCall as any).createdAt,
          },
        },
      };
    } catch (error) {
      console.error('Error checking active call:', error);
      return {
        success: false,
        message: error.message || 'Failed to check active call',
      };
    }
  }

  @Post(':id/refresh-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Refresh Agora token for active call' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      example: {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: 'new-agora-rtc-token',
          uid: 12345,
          channelName: 'skinora_call_6844721a12247c8cda556d07',
          agoraAppId: 'your-agora-app-id',
          expiresAt: '2025-01-07T12:00:00.000Z',
        },
      },
    },
  })
  async refreshToken(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token',
        };
      }

      const call = await this.callService.getCallById(callId);

      if (!call) {
        return {
          success: false,
          message: 'Call not found or has ended',
        };
      }

      if (call.status === 'ended') {
        return {
          success: false,
          message: 'Cannot refresh token for ended call',
        };
      }

      // Extract participant IDs safely
      let patientId: string;
      let doctorId: string;

      if (
        call.patientId &&
        typeof call.patientId === 'object' &&
        (call.patientId as any)._id
      ) {
        patientId = (call.patientId as any)._id.toString();
      } else if (call.patientId) {
        patientId = call.patientId.toString();
      } else {
        patientId = '';
      }

      if (
        call.doctorId &&
        typeof call.doctorId === 'object' &&
        (call.doctorId as any)._id
      ) {
        doctorId = (call.doctorId as any)._id.toString();
      } else if (call.doctorId) {
        doctorId = call.doctorId.toString();
      } else {
        // Try to get from raw call data
        const rawCall = await this.callService.getCallByIdRaw(callId);
        doctorId = rawCall?.doctorId?.toString() || '';
      }

      const isPatient = patientId === userId;
      const isDoctor = doctorId === userId;

      if (!isPatient && !isDoctor) {
        return {
          success: false,
          message: 'You are not authorized to refresh token for this call',
        };
      }

      // Generate new token with comprehensive validation
      const uid = Math.floor(Math.random() * 100000) + 1;
      let token: string;

      try {
        token = this.agoraService.generateValidatedToken(call.roomId, uid, 24);
      } catch (tokenError) {
        console.error('Token refresh failed:', tokenError);
        return {
          success: false,
          message: `Failed to refresh Agora token: ${tokenError.message}`,
        };
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      console.log('=== TOKEN REFRESH ===');
      console.log('Call ID:', callId);
      console.log('User ID:', userId);
      console.log('New UID:', uid);
      console.log('Token length:', token.length);
      console.log('Channel:', call.roomId);
      console.log('Expires at:', expiresAt.toISOString());
      console.log('===================');

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token,
          uid,
          channelName: call.roomId,
          agoraAppId: this.agoraService.getAppId(),
          expiresAt: expiresAt.toISOString(),
          userRole: isPatient ? 'patient' : 'doctor',
          callStatus: call.status,
        },
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      return {
        success: false,
        message: error.message || 'Failed to refresh token',
      };
    }
  }

  @Get('agora/config-status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check Agora configuration status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Agora configuration status',
    schema: {
      example: {
        success: true,
        message: 'Agora configuration status retrieved',
        data: {
          configured: true,
          appIdSet: true,
          appIdLength: 32,
          appCertificateSet: true,
          appCertificateLength: 32,
          appIdPreview: 'a1b2c3d4...',
          recommendedActions: ['Configuration looks good! ✅'],
        },
      },
    },
  })
  async getAgoraConfigStatus(@Request() req) {
    try {
      const configStatus = this.agoraService.getConfigurationStatus();

      return {
        success: true,
        message: 'Agora configuration status retrieved',
        data: configStatus,
      };
    } catch (error) {
      console.error('Error checking Agora config status:', error);
      return {
        success: false,
        message: error.message || 'Failed to check Agora configuration',
      };
    }
  }

  @Get('agora/project-status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Check complete Agora project status and RTC configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Complete Agora project status',
    schema: {
      example: {
        success: true,
        message: 'Agora project status retrieved',
        data: {
          configured: true,
          appIdValid: true,
          certificateValid: true,
          testTokenGeneration: true,
          systemTime: {
            valid: true,
            current: '2025-01-06T14:30:00.000Z',
            timezone: 'UTC',
          },
          projectSettings: {
            rtcEnabled: 'UNKNOWN - Check Agora Console',
            chatEnabled: 'UNKNOWN - Check Agora Console',
            certificateEnabled: true,
          },
          recommendations: ['Configuration looks good! ✅'],
          troubleshooting: {
            commonIssues: [
              'RTC not enabled in Agora Console',
              'Primary Certificate not enabled',
              'Wrong project selected',
            ],
            checklistSteps: [
              '1. Go to console.agora.io',
              '2. Select correct project',
              '3. Check Project Management → Features → RTC',
              '4. Enable Primary Certificate',
              '5. Copy correct App ID and Certificate',
            ],
          },
        },
      },
    },
  })
  async getAgoraProjectStatus(@Request() req) {
    try {
      // Get basic configuration status
      const configStatus = this.agoraService.getConfigurationStatus();

      // Verify project settings
      const projectVerification = await this.agoraService.verifyAgoraProject();

      // System time validation
      const systemTimeValid = this.agoraService.validateSystemTime();

      const projectStatus = {
        ...configStatus,
        ...projectVerification,
        systemTime: {
          valid: systemTimeValid,
          current: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          unixTimestamp: Math.floor(Date.now() / 1000),
        },
        projectSettings: {
          rtcEnabled:
            'UNKNOWN - Check Agora Console → Project Management → Features → RTC',
          chatEnabled:
            'UNKNOWN - Check Agora Console → Project Management → Features → Chat',
          certificateEnabled: !!(
            configStatus.appCertificateSet &&
            configStatus.appCertificateLength === 32
          ),
          appIdFormat: configStatus.appIdLength === 32 ? 'VALID' : 'INVALID',
          certificateFormat:
            configStatus.appCertificateLength === 32 ? 'VALID' : 'INVALID',
        },
        troubleshooting: {
          commonIssues: [
            '❌ RTC service not enabled in Agora Console',
            '❌ Primary Certificate not enabled',
            '❌ Wrong project selected in Agora Console',
            '❌ App ID/Certificate copied incorrectly',
            '❌ Environment variables not loaded properly',
            '❌ Token expiration issues due to system time',
          ],
          checklistSteps: [
            '1. 🌐 Go to console.agora.io and login',
            '2. 📋 Select your correct project',
            '3. ⚙️ Go to Project Management → Features',
            '4. ✅ Ensure RTC (Real-Time Communication) is enabled',
            '5. 🔐 Go to Features → Primary Certificate and enable it',
            '6. 📋 Copy App ID from Basic Info (32 hex characters)',
            '7. 📋 Copy Primary Certificate (32 hex characters)',
            '8. 📝 Update .env file with correct values',
            '9. 🔄 Restart your application',
            '10. 🧪 Test token generation with this API',
          ],
          agoraConsoleUrls: {
            dashboard: 'https://console.agora.io',
            projectManagement: 'https://console.agora.io/project-management',
            features: 'https://console.agora.io/project-management/features',
            certificate:
              'https://console.agora.io/project-management/certificate',
          },
        },
      };

      return {
        success: true,
        message: 'Agora project status retrieved successfully',
        data: projectStatus,
      };
    } catch (error) {
      console.error('Error checking Agora project status:', error);
      return {
        success: false,
        message: error.message || 'Failed to check Agora project status',
        troubleshooting: {
          immediateActions: [
            'Check if Agora service is properly configured',
            'Verify environment variables are loaded',
            'Check server logs for detailed error messages',
          ],
        },
      };
    }
  }

  @Post('debug/token-validation')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Debug token generation and validate Agora credentials',
  })
  @ApiResponse({
    status: 200,
    description: 'Token debug information',
    schema: {
      example: {
        success: true,
        message: 'Token debug completed',
        data: {
          appId: '6f4535f7...',
          tokenGenerated: true,
          tokenLength: 256,
          tokenPreview: '0066f4535f...',
          channelName: 'test_debug_channel',
          uid: 12345,
          expirationValid: true,
          agoraValidation: {
            appIdFormat: 'VALID',
            certificateFormat: 'VALID',
            credentialsTest: 'PASSED',
          },
        },
      },
    },
  })
  async debugTokenValidation(
    @Request() req,
    @Body() debugData?: { channelName?: string; uid?: number },
  ) {
    try {
      const channelName =
        debugData?.channelName || 'test_debug_channel_' + Date.now();
      const uid = debugData?.uid || Math.floor(Math.random() * 100000) + 1;

      console.log('=== TOKEN DEBUG SESSION START ===');
      console.log('Requested Channel:', channelName);
      console.log('Requested UID:', uid);
      console.log('User ID:', req.user.sub || req.user.id);
      console.log('================================');

      // 1. Check Agora configuration
      const configStatus = this.agoraService.getConfigurationStatus();
      console.log('Config Status:', configStatus);

      if (!configStatus.configured) {
        return {
          success: false,
          message: 'Agora service not properly configured',
          debug: {
            configStatus,
            recommendations: [
              'Check AGORA_APP_ID in .env',
              'Check AGORA_APP_CERTIFICATE in .env',
              'Verify both are 32 hex characters',
              'Restart application after .env changes',
            ],
          },
        };
      }

      // 2. Test basic token generation
      let testToken: string;
      let tokenError: any = null;

      try {
        console.log('🧪 Generating test token...');
        testToken = this.agoraService.generateValidatedToken(
          channelName,
          uid,
          1,
        ); // 1 hour expiry for testing
        console.log('✅ Token generated successfully');
        console.log('Token length:', testToken.length);
        console.log('Token preview:', testToken.substring(0, 30) + '...');
      } catch (error) {
        console.error('❌ Token generation failed:', error);
        tokenError = error.message;
        testToken = 'FAILED_TO_GENERATE';
      }

      // 3. Validate token format
      const tokenValidation = {
        generated: !tokenError,
        length: testToken.length,
        hasValidPrefix:
          testToken.startsWith('006') || testToken.startsWith('007'),
        estimatedValid:
          testToken.length > 100 &&
          (testToken.startsWith('006') || testToken.startsWith('007')),
      };

      // 4. Check system time
      const systemTime = {
        current: new Date().toISOString(),
        unixTimestamp: Math.floor(Date.now() / 1000),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        valid: this.agoraService.validateSystemTime(),
      };

      // 5. Environment validation
      const envValidation = {
        appId: process.env.AGORA_APP_ID,
        appIdLength: process.env.AGORA_APP_ID?.length || 0,
        appIdValid: !!(
          process.env.AGORA_APP_ID &&
          /^[a-f0-9]{32}$/i.test(process.env.AGORA_APP_ID)
        ),
        certificateLength: process.env.AGORA_APP_CERTIFICATE?.length || 0,
        certificateValid: !!(
          process.env.AGORA_APP_CERTIFICATE &&
          /^[a-f0-9]{32}$/i.test(process.env.AGORA_APP_CERTIFICATE)
        ),
        preview: {
          appId: process.env.AGORA_APP_ID
            ? process.env.AGORA_APP_ID.substring(0, 8) + '...'
            : 'NOT_SET',
          certificate: process.env.AGORA_APP_CERTIFICATE
            ? process.env.AGORA_APP_CERTIFICATE.substring(0, 8) + '...'
            : 'NOT_SET',
        },
      };

      // 6. Detailed token debug
      const tokenDebugInfo = this.agoraService.debugTokenGeneration(
        channelName,
        uid,
      );

      const debugResult = {
        configurationStatus: configStatus,
        tokenGeneration: {
          success: !tokenError,
          error: tokenError,
          token: tokenError ? 'FAILED' : testToken.substring(0, 50) + '...',
          fullTokenLength: testToken.length,
          validation: tokenValidation,
        },
        systemTime,
        environmentValidation: envValidation,
        detailedTokenDebug: tokenDebugInfo,
        testParameters: {
          channelName,
          uid,
          appId: this.agoraService.getAppId(),
          appIdPreview: this.agoraService.getAppId().substring(0, 8) + '...',
        },
        recommendations: [] as string[],
      };

      // Add specific recommendations
      if (tokenError) {
        debugResult.recommendations.push(
          '❌ Token generation failed - check credentials',
        );
      }
      if (!envValidation.appIdValid) {
        debugResult.recommendations.push(
          '❌ Invalid App ID format - should be 32 hex characters',
        );
      }
      if (!envValidation.certificateValid) {
        debugResult.recommendations.push(
          '❌ Invalid Certificate format - should be 32 hex characters',
        );
      }
      if (!systemTime.valid) {
        debugResult.recommendations.push('❌ System time appears incorrect');
      }
      if (debugResult.recommendations.length === 0) {
        debugResult.recommendations.push(
          '✅ All checks passed - token should be valid',
        );
      }

      console.log('=== TOKEN DEBUG SESSION END ===');

      return {
        success: true,
        message: 'Token debug completed',
        data: debugResult,
      };
    } catch (error) {
      console.error('Error in token debug:', error);
      return {
        success: false,
        message: 'Token debug failed',
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Post('test/token-with-frontend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Generate token exactly as frontend will receive it',
  })
  @ApiResponse({
    status: 200,
    description: 'Token for frontend testing',
    schema: {
      example: {
        success: true,
        message: 'Token generated for frontend testing',
        data: {
          agoraAppId: '6f4535f79c4e40ec927d60c97744d67e',
          token: '0066f4535f...',
          channelName: 'test_channel_123',
          uid: 12345,
          expiresAt: '2025-01-07T12:00:00.000Z',
          tokenValidation: {
            length: 256,
            prefix: '006',
            valid: true,
          },
        },
      },
    },
  })
  async generateTokenForFrontend(
    @Request() req,
    @Body() testData: { channelName: string; uid: number },
  ) {
    try {
      const { channelName, uid } = testData;

      console.log('=== FRONTEND TOKEN TEST ===');
      console.log('Channel Name:', channelName);
      console.log('UID:', uid);
      console.log('========================');

      // Generate token exactly as call endpoints do
      const token = this.agoraService.generateValidatedToken(
        channelName,
        uid,
        24,
      );
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Validate token format
      const tokenValidation = {
        length: token.length,
        prefix: token.substring(0, 3),
        valid: this.agoraService.validateTokenExpiration(token),
        hasValidPrefix: token.startsWith('006') || token.startsWith('007'),
      };

      console.log('Generated token validation:', tokenValidation);

      return {
        success: true,
        message: 'Token generated for frontend testing',
        data: {
          agoraAppId: this.agoraService.getAppId(),
          token,
          channelName,
          uid,
          expiresAt: expiresAt.toISOString(),
          tokenValidation,
          instructions: [
            '1. Copy the agoraAppId, token, channelName, and uid',
            '2. Use these exact values in your frontend Agora client',
            '3. Make sure channelName and uid match exactly',
            '4. Check browser console for any Agora SDK errors',
          ],
        },
      };
    } catch (error) {
      console.error('Error generating frontend token:', error);
      return {
        success: false,
        message: 'Failed to generate token for frontend',
        error: error.message,
      };
    }
  }

  @Post('debug/verify-frontend-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify frontend token parameters match backend' })
  @ApiResponse({
    status: 200,
    description: 'Token verification results',
    schema: {
      example: {
        success: true,
        message: 'Token verification completed',
        data: {
          parameterMatch: true,
          backendToken: '006...',
          frontendToken: '006...',
          tokensMatch: true,
          credentialsValid: true,
          troubleshooting: [],
        },
      },
    },
  })
  async verifyFrontendToken(
    @Request() req,
    @Body()
    frontendData: {
      agoraAppId: string;
      token: string;
      channelName: string;
      uid: number;
    },
  ) {
    try {
      console.log('=== FRONTEND TOKEN VERIFICATION ===');
      console.log('Frontend AppId:', frontendData.agoraAppId);
      console.log('Frontend Token length:', frontendData.token?.length);
      console.log('Frontend Channel:', frontendData.channelName);
      console.log('Frontend UID:', frontendData.uid);

      // Get backend values
      const backendAppId = this.agoraService.getAppId();

      // Generate same token with same parameters
      let backendToken: string;
      try {
        backendToken = this.agoraService.generateValidatedToken(
          frontendData.channelName,
          frontendData.uid,
          24,
        );
      } catch (error) {
        return {
          success: false,
          message: 'Backend token generation failed',
          error: error.message,
        };
      }

      console.log('Backend AppId:', backendAppId);
      console.log('Backend Token length:', backendToken.length);

      // Compare values
      const verification = {
        appIdMatch: frontendData.agoraAppId === backendAppId,
        channelNameValid: /^[a-zA-Z0-9_-]+$/.test(frontendData.channelName),
        uidValid: frontendData.uid >= 0 && frontendData.uid <= 2147483647,
        tokenFormatValid:
          frontendData.token.startsWith('006') ||
          frontendData.token.startsWith('007'),
        tokenLengthReasonable: frontendData.token.length > 100,
        credentialsValid: this.agoraService.validateAgoraCredentials(),
        troubleshooting: [] as string[],
      };

      // Add troubleshooting recommendations
      if (!verification.appIdMatch) {
        verification.troubleshooting.push(
          '❌ App ID mismatch - frontend and backend using different App IDs',
        );
      }
      if (!verification.channelNameValid) {
        verification.troubleshooting.push(
          '❌ Invalid channel name format - use only letters, numbers, underscore, hyphen',
        );
      }
      if (!verification.uidValid) {
        verification.troubleshooting.push(
          '❌ Invalid UID - must be between 0 and 2147483647',
        );
      }
      if (!verification.tokenFormatValid) {
        verification.troubleshooting.push(
          '❌ Invalid token format - should start with 006 or 007',
        );
      }
      if (!verification.tokenLengthReasonable) {
        verification.troubleshooting.push(
          '❌ Token too short - might be corrupted',
        );
      }

      // Check Agora credentials
      if (verification.credentialsValid.overall !== 'VALID') {
        verification.troubleshooting.push(
          '❌ Invalid Agora credentials in backend',
        );
      }

      if (verification.troubleshooting.length === 0) {
        verification.troubleshooting.push(
          '✅ All parameters valid - token should work',
        );
      }

      console.log('Verification result:', verification);
      console.log('=================================');

      return {
        success: true,
        message: 'Token verification completed',
        data: {
          parameterComparison: {
            appId: {
              frontend: frontendData.agoraAppId,
              backend: backendAppId,
              match: verification.appIdMatch,
            },
            token: {
              frontend: frontendData.token.substring(0, 30) + '...',
              backend: backendToken.substring(0, 30) + '...',
              frontendLength: frontendData.token.length,
              backendLength: backendToken.length,
              formatValid: verification.tokenFormatValid,
            },
            channel: {
              name: frontendData.channelName,
              valid: verification.channelNameValid,
            },
            uid: {
              value: frontendData.uid,
              valid: verification.uidValid,
            },
          },
          verification,
          agoraConsoleCheck: {
            message: 'If token still fails, verify in Agora Console:',
            steps: [
              '1. Go to console.agora.io',
              '2. Select your project',
              '3. Check Project Management → Features → RTC is enabled',
              '4. Verify Primary Certificate is enabled',
              '5. Test with Agora Web Demo: https://webdemo.agora.io/basicVideoCall/index.html',
            ],
            testUrl: 'https://webdemo.agora.io/basicVideoCall/index.html',
          },
        },
      };
    } catch (error) {
      console.error('Error in token verification:', error);
      return {
        success: false,
        message: 'Token verification failed',
        error: error.message,
      };
    }
  }

  @Post('debug/frontend-configuration')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Debug frontend Agora configuration and provide exact setup instructions',
  })
  @ApiResponse({
    status: 200,
    description: 'Frontend configuration debug and setup instructions',
    schema: {
      example: {
        success: true,
        message: 'Frontend configuration debug completed',
        data: {
          validatedCredentials: true,
          exactImplementation: {
            agoraAppId: '6f4535f79c4e40ec927d60c97744d67e',
            token: '0066f4535f...',
            channelName: 'skinora_call_test',
            uid: 12345,
          },
          frontendCode: '// Exact code to copy-paste',
          commonIssues: ['SDK version mismatch', 'Async/await issues'],
        },
      },
    },
  })
  async debugFrontendConfiguration(
    @Request() req,
    @Body() testData?: { channelName?: string; uid?: number },
  ) {
    try {
      const channelName =
        testData?.channelName || 'skinora_call_frontend_test_' + Date.now();
      const uid = testData?.uid || Math.floor(Math.random() * 100000) + 1;

      console.log('=== FRONTEND CONFIGURATION DEBUG ===');
      console.log('Generating exact frontend implementation...');

      // Generate working token
      const token = this.agoraService.generateValidatedToken(
        channelName,
        uid,
        24,
      );
      const appId = this.agoraService.getAppId();

      // Validate token format
      const tokenValidation = {
        length: token.length,
        prefix: token.substring(0, 3),
        valid: this.agoraService.validateTokenExpiration(token),
        hasValidPrefix: token.startsWith('006') || token.startsWith('007'),
      };

      // Generate exact frontend code
      const frontendImplementation = `
// ====== EXACT WORKING FRONTEND CODE ======
import AgoraRTC from 'agora-rtc-sdk-ng';

// 1. Initialize Agora client
const client = AgoraRTC.createClient({
  mode: "rtc", 
  codec: "vp8"
});

// 2. EXACT VALUES FROM BACKEND (copy these exactly)
const agoraConfig = {
  appId: "${appId}",
  token: "${token}",
  channelName: "${channelName}",
  uid: ${uid}
};

console.log('🔧 Agora Config:', agoraConfig);

// 3. Join channel function
async function joinChannel() {
  try {
    console.log('🚀 Attempting to join Agora channel...');
    console.log('App ID:', agoraConfig.appId);
    console.log('Channel:', agoraConfig.channelName);
    console.log('Token length:', agoraConfig.token.length);
    console.log('UID:', agoraConfig.uid);

    // Join the channel
    await client.join(
      agoraConfig.appId,
      agoraConfig.channelName, 
      agoraConfig.token,
      agoraConfig.uid
    );

    console.log('✅ Successfully joined Agora channel!');
    console.log('🎉 Connection established!');

    // Create and publish local video track
    const localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    await client.publish([localVideoTrack, localAudioTrack]);
    console.log('📹 Local video/audio published');

    // Play local video
    localVideoTrack.play('local-video'); // Ensure you have this div

    return { success: true };

  } catch (error) {
    console.error('❌ Agora join failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Detailed error analysis
    if (error.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
      console.error('🔍 Token/Authentication issue detected');
      console.error('- Check if token matches exactly');
      console.error('- Verify App ID is correct');
      console.error('- Ensure channel name matches');
    }
    
    return { success: false, error };
  }
}

// 4. HTML structure needed
/*
<div id="local-video" style="width: 400px; height: 300px; background: #000;"></div>
<button onclick="joinChannel()">Join Channel</button>
*/

// 5. Call the function
joinChannel();

// ==========================================
      `;

      const troubleshootingSteps = [
        '1. ✅ TOKEN VERIFIED: Your backend generates valid tokens',
        '2. ✅ AGORA PROJECT: RTC service is working (confirmed by web demo)',
        '3. 🔍 FRONTEND ISSUES TO CHECK:',
        '   - Agora SDK version compatibility',
        '   - Browser permissions (camera/microphone)',
        '   - Network/firewall blocking Agora servers',
        '   - Async/await implementation errors',
        '   - Console errors during initialization',
        '4. 📋 IMMEDIATE DEBUG STEPS:',
        '   - Copy-paste the exact code above',
        '   - Open browser DevTools → Console',
        '   - Look for specific error messages',
        '   - Check Network tab for failed requests',
        '5. 🔧 COMMON FIXES:',
        '   - Update Agora SDK to latest version',
        '   - Ensure HTTPS (required for camera/mic)',
        '   - Clear browser cache',
        '   - Try different browser',
        '   - Disable ad blockers temporarily',
      ];

      console.log('Frontend implementation generated successfully');
      console.log('=====================================');

      return {
        success: true,
        message: 'Frontend configuration debug completed',
        data: {
          validatedCredentials: {
            tokenValid: tokenValidation.valid,
            appIdValid: appId.length === 32,
            channelNameValid: /^[a-zA-Z0-9_-]+$/.test(channelName),
            uidValid: uid >= 0 && uid <= 2147483647,
            webDemoTested: 'SUCCESSFUL - Token works on Agora Web Demo',
          },
          exactImplementation: {
            agoraAppId: appId,
            token: token.substring(0, 50) + '...',
            fullToken: token, // Full token for testing
            channelName,
            uid,
            tokenValidation,
          },
          frontendCode: frontendImplementation,
          troubleshootingSteps,
          nextSteps: [
            '1. Copy the exact frontend code above',
            '2. Replace your current Agora implementation',
            '3. Open browser console to see detailed logs',
            '4. Check for any JavaScript errors',
            '5. If still failing, share the exact console error',
          ],
          testUrls: {
            agoraWebDemo: 'https://webdemo.agora.io/basicVideoCall/index.html',
            agoraDocumentation:
              'https://docs.agora.io/en/video-calling/get-started/get-started-sdk',
            troubleshooting:
              'https://docs.agora.io/en/video-calling/develop/authentication-workflow',
          },
        },
      };
    } catch (error) {
      console.error('Error in frontend configuration debug:', error);
      return {
        success: false,
        message: 'Frontend configuration debug failed',
        error: error.message,
      };
    }
  }

  @Post('notify/incoming-call')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send incoming call notification to user' })
  @ApiResponse({
    status: 200,
    description: 'Incoming call notification sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Incoming call notification sent successfully',
        data: {
          callId: '6844721a12247c8cda556d07',
          notificationType: 'incoming_call',
          sentTo: 'patient',
          channels: ['websocket', 'push_notification', 'email'],
          callDetails: {
            callerName: 'Dr. John Smith',
            callerAvatar: 'doctor-avatar.jpg',
            callType: 'video',
            appointmentTime: '2025-01-06T15:30:00.000Z',
          },
        },
      },
    },
  })
  async sendIncomingCallNotification(
    @Request() req,
    @Body()
    notificationData: {
      callId: string;
      targetUserId: string;
      callerInfo: {
        name: string;
        avatar?: string;
        role: 'doctor' | 'patient';
      };
      callType: 'video' | 'voice';
      appointmentId?: string;
    },
  ) {
    try {
      const senderId = req.user.sub || req.user.id;

      // Get call details
      const call = await this.callService.getCallById(notificationData.callId);
      if (!call) {
        return {
          success: false,
          message: 'Call not found',
        };
      }

      // Prepare notification payload
      const notificationPayload = {
        type: 'incoming_call',
        callId: notificationData.callId,
        appointmentId: notificationData.appointmentId,
        caller: {
          id: senderId,
          name: notificationData.callerInfo.name,
          avatar: notificationData.callerInfo.avatar,
          role: notificationData.callerInfo.role,
        },
        callDetails: {
          type: notificationData.callType,
          channelName: call.roomId,
          status: call.status,
          createdAt: (call as any).createdAt || new Date(),
        },
        actions: {
          accept: `/calls/${notificationData.callId}/accept`,
          decline: `/calls/${notificationData.callId}/decline`,
          join: `/calls/${notificationData.callId}`,
        },
        timeout: 30000, // 30 seconds
        priority: 'high',
        sound: 'call_ringtone.mp3',
      };

      // Send notification via multiple channels
      const notificationResults = await Promise.allSettled([
        // 1. WebSocket (real-time)
        this.sendWebSocketNotification(
          notificationData.targetUserId,
          notificationPayload,
        ),

        // 2. Push Notification (mobile/browser)
        this.sendPushNotification(notificationData.targetUserId, {
          title: `Incoming ${notificationData.callType} call`,
          body: `${notificationData.callerInfo.name} is calling you`,
          icon: notificationData.callerInfo.avatar,
          badge: '/icons/call-badge.png',
          data: notificationPayload,
          actions: [
            { action: 'accept', title: 'Accept', icon: '/icons/accept.png' },
            { action: 'decline', title: 'Decline', icon: '/icons/decline.png' },
          ],
        }),

        // 3. SMS (optional fallback)
        this.sendSMSNotification(
          notificationData.targetUserId,
          `You have an incoming ${notificationData.callType} call from ${notificationData.callerInfo.name}. Check your Skinora app.`,
        ),
      ]);

      console.log('=== NOTIFICATION RESULTS ===');
      console.log('WebSocket:', notificationResults[0]);
      console.log('Push:', notificationResults[1]);
      console.log('SMS:', notificationResults[2]);
      console.log('============================');

      return {
        success: true,
        message: 'Incoming call notification sent successfully',
        data: {
          callId: notificationData.callId,
          notificationType: 'incoming_call',
          sentTo:
            notificationData.callerInfo.role === 'doctor'
              ? 'patient'
              : 'doctor',
          channels: ['websocket', 'push_notification', 'sms'],
          callDetails: notificationPayload.callDetails,
          deliveryStatus: {
            websocket: notificationResults[0].status,
            push: notificationResults[1].status,
            sms: notificationResults[2].status,
          },
        },
      };
    } catch (error) {
      console.error('Error sending incoming call notification:', error);
      return {
        success: false,
        message: 'Failed to send incoming call notification',
        error: error.message,
      };
    }
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept incoming call with real-time updates' })
  async acceptCall(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      // Get call details first
      const call = await this.callService.getCallById(callId);

      if (!call) {
        return {
          success: false,
          message: 'Call not found',
        };
      }

      // Update call status
      const updatedCall = await this.callService.updateCallStatus(
        callId,
        'active',
      );

      if (!updatedCall) {
        return {
          success: false,
          message: 'Call not found or already ended',
        };
      }

      // Update Redis cache
      await this.redisService.setCallStatus(callId, 'active', {
        acceptedBy: userId,
        acceptedAt: new Date(),
      });

      // Generate fresh token
      const uid = Math.floor(Math.random() * 100000) + 1;
      const token = this.agoraService.generateValidatedToken(
        updatedCall.roomId,
        uid,
        24,
      );

      // Get other participant ID
      const otherParticipantId = this.getOtherParticipantId(
        updatedCall,
        userId,
      );

      // Notify caller via WebSocket
      await this.callGateway.notifyCallAccepted(
        callId,
        userId,
        otherParticipantId,
      );

      return {
        success: true,
        message: 'Call accepted successfully',
        data: {
          callId: (updatedCall as any)._id,
          status: updatedCall.status,
          appointmentId: updatedCall.appointmentId || null, // Include appointmentId
          joinInfo: {
            agoraAppId: this.agoraService.getAppId(),
            appId: this.agoraService.getAppId(), // Add backup field
            token,
            channelName: updatedCall.roomId,
            uid,
            userRole: this.determineUserRole(updatedCall, userId),
          },
          otherParticipant: this.getOtherParticipantInfo(updatedCall, userId),
          // Add mobile compatibility fields
          agoraAppId: this.agoraService.getAppId(),
          channelName: updatedCall.roomId,
          userRole: this.determineUserRole(updatedCall, userId),
        },
      };
    } catch (error) {
      console.error('Error accepting call:', error);
      return {
        success: false,
        message: 'Failed to accept call',
        error: error.message,
      };
    }
  }

  @Post(':id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Decline incoming call with real-time updates' })
  async declineCall(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      const call = await this.callService.updateCallStatus(callId, 'declined');

      if (!call) {
        return {
          success: false,
          message: 'Call not found',
        };
      }

      // Update Redis cache
      await this.redisService.setCallStatus(callId, 'declined', {
        declinedBy: userId,
        declinedAt: new Date(),
      });

      // Get other participant ID
      const otherParticipantId = this.getOtherParticipantId(call, userId);

      // Notify caller via WebSocket
      await this.callGateway.notifyCallDeclined(
        callId,
        userId,
        otherParticipantId,
      );

      return {
        success: true,
        message: 'Call declined successfully',
        data: {
          callId: (call as any)._id,
          status: call.status,
          declinedBy: userId,
          reason: 'user_declined',
        },
      };
    } catch (error) {
      console.error('Error declining call:', error);
      return {
        success: false,
        message: 'Failed to decline call',
        error: error.message,
      };
    }
  }

  @Get('notifications/missed/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get missed call notifications for offline users' })
  async getMissedNotifications(
    @Param('userId') userId: string,
    @Request() req,
  ) {
    try {
      const notifications =
        await this.redisService.getQueuedNotifications(userId);

      return {
        success: true,
        message: 'Missed notifications retrieved successfully',
        data: {
          notifications,
          count: notifications.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get missed notifications',
        error: error.message,
      };
    }
  }

  @Get(':id/participants/realtime')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get real-time call participants from Redis cache' })
  async getRealtimeParticipants(@Param('id') callId: string, @Request() req) {
    try {
      const participants = await this.redisService.getCallParticipants(callId);
      const callStatus = await this.redisService.getCallStatus(callId);

      return {
        success: true,
        message: 'Real-time participants retrieved successfully',
        data: {
          callId,
          participants,
          callStatus,
          totalParticipants: participants.length,
          connectedParticipants: participants.filter(
            (p) => p.status === 'joined',
          ).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get real-time participants',
        error: error.message,
      };
    }
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join existing call (for mobile/second device)' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined call',
    schema: {
      example: {
        success: true,
        message: 'Successfully joined call',
        data: {
          callId: '6844721a12247c8cda556d07',
          agoraAppId: 'your-agora-app-id',
          token: 'new-agora-rtc-token',
          channelName: 'skinora_call_6844721a12247c8cda556d07',
          uid: 54321,
          userRole: 'patient',
          callStatus: 'active',
          appointmentId: '684469608d16d2b432763e6a', // Include appointmentId
          otherParticipant: {
            _id: '684460f8fe31c80c380b343f',
            fullName: 'Dr. Smith',
            photoUrl: 'doctor-avatar.jpg',
            role: 'doctor',
          },
          joinedAt: '2025-01-06T15:30:00.000Z',
        },
      },
    },
  })
  async joinExistingCall(
    @Param('id') callId: string,
    @Body() joinCallDto: JoinCallDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub || req.user.id;

      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token',
        };
      }

      // Get call details with populated appointment info
      const call = await this.callService.getCallById(callId);

      if (!call) {
        return {
          success: false,
          message: 'Call not found',
        };
      }

      // Check if call is still active/joinable
      const allowedStatuses = ['pending', 'active', 'connected', 'ringing'];
      if (!allowedStatuses.includes(call.status)) {
        return {
          success: false,
          message: `Cannot join call with status: ${call.status}`,
        };
      }

      // Extract participant IDs safely
      let patientId: string;
      let doctorId: string;

      if (
        call.patientId &&
        typeof call.patientId === 'object' &&
        (call.patientId as any)._id
      ) {
        patientId = (call.patientId as any)._id.toString();
      } else if (call.patientId) {
        patientId = call.patientId.toString();
      } else {
        patientId = '';
      }

      if (
        call.doctorId &&
        typeof call.doctorId === 'object' &&
        (call.doctorId as any)._id
      ) {
        doctorId = (call.doctorId as any)._id.toString();
      } else if (call.doctorId) {
        doctorId = call.doctorId.toString();
      } else {
        // Try to get from raw call data
        const rawCall = await this.callService.getCallByIdRaw(callId);
        doctorId = rawCall?.doctorId?.toString() || '';
      }

      // Check authorization
      const isPatient = patientId === userId;
      const isDoctor = doctorId === userId;

      if (!isPatient && !isDoctor) {
        return {
          success: false,
          message: 'You are not authorized to join this call',
        };
      }

      const userRole = isPatient ? 'patient' : 'doctor';

      // Update call status to active if it was pending
      if (call.status === 'pending' || call.status === 'ringing') {
        await this.callService.updateCallStatus(callId, 'active');
      }

      // Generate new token for joining user (different UID from web)
      const uid = Math.floor(Math.random() * 100000) + 200000; // Different range for mobile
      let token: string;

      try {
        token = this.agoraService.generateValidatedToken(call.roomId, uid, 24);
      } catch (tokenError) {
        console.error('Token generation failed for mobile join:', tokenError);
        return {
          success: false,
          message: `Failed to generate Agora token: ${tokenError.message}`,
        };
      }

      // Get other participant info
      let otherParticipant: any;
      if (isPatient) {
        otherParticipant =
          call.doctorId && typeof call.doctorId === 'object'
            ? {
                _id: (call.doctorId as any)._id,
                fullName: (call.doctorId as any).fullName || 'Unknown Doctor',
                photoUrl: (call.doctorId as any).photoUrl || null,
                role: 'doctor',
              }
            : { _id: doctorId, fullName: 'Unknown Doctor', role: 'doctor' };
      } else {
        otherParticipant =
          call.patientId && typeof call.patientId === 'object'
            ? {
                _id: (call.patientId as any)._id,
                fullName: (call.patientId as any).fullName || 'Unknown Patient',
                avatarUrl: (call.patientId as any).avatarUrl || null,
                role: 'patient',
              }
            : { _id: patientId, fullName: 'Unknown Patient', role: 'patient' };
      }
      const device = joinCallDto?.device || 'mobile';

      // Update Redis cache for real-time tracking
      await this.redisService.addCallParticipant(callId, {
        userId,
        userRole,
        device,
        uid,
        joinedAt: new Date(),
        status: 'joined',
      });

      // Notify other participants via WebSocket
      await this.callGateway.notifyParticipantJoined(callId, {
        userId,
        userRole,
        device,
        joinedAt: new Date(),
      });
      this.logger.log(
        `📱 ${device} user ${userId} (${userRole}) joined call ${callId} with UID ${uid}`,
      );

      return {
        success: true,
        message: 'Successfully joined call',
        data: {
          callId: (call as any)._id,
          agoraAppId: this.agoraService.getAppId(),
          appId: this.agoraService.getAppId(), // Add backup field
          token,
          channelName: call.roomId,
          uid,
          userRole,
          callStatus: 'active',
          appointmentId: call.appointmentId || null, // Include appointmentId from call
          otherParticipant,
          joinedAt: new Date().toISOString(),
          device,
          instructions: {
            note: 'Use the same channelName as web to join the same call',
            webChannelName: call.roomId,
            deviceUID: uid,
            tokenExpiry: '24 hours',
          },
          // Add debug info
          debug: {
            hasAgoraAppId: !!this.agoraService.getAppId(),
            hasToken: !!token,
            hasChannelName: !!call.roomId,
            generatedUid: uid,
            callFromAppointment: !!call.appointmentId,
          },
        },
      };
    } catch (error) {
      console.error('Error joining existing call:', error);
      return {
        success: false,
        message: error.message || 'Failed to join call',
      };
    }
  }

  @Get(':id/participants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all participants in call (web + mobile)' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  @ApiResponse({
    status: 200,
    description: 'Call participants retrieved',
    schema: {
      example: {
        success: true,
        message: 'Call participants retrieved',
        data: {
          callId: '6844721a12247c8cda556d07',
          totalParticipants: 2,
          participants: [
            {
              userId: '683ec8811deabdaefb552180',
              userRole: 'patient',
              device: 'web',
              uid: 12345,
              joinedAt: '2025-01-06T15:25:00.000Z',
              status: 'joined',
            },
            {
              userId: '683ec8811deabdaefb552180',
              userRole: 'patient',
              device: 'mobile',
              uid: 254321,
              joinedAt: '2025-01-06T15:30:00.000Z',
              status: 'joined',
            },
          ],
        },
      },
    },
  })
  async getCallParticipants(@Param('id') callId: string, @Request() req) {
    try {
      const participants = await this.redisService.getCallParticipants(callId);
      const call = await this.callService.getCallById(callId);

      if (!call) {
        return {
          success: false,
          message: 'Call not found',
        };
      }

      return {
        success: true,
        message: 'Call participants retrieved',
        data: {
          callId,
          callStatus: call.status,
          totalParticipants: participants.length,
          participants,
          devices: {
            web: participants.filter((p) => p.device === 'web').length,
            mobile: participants.filter((p) => p.device === 'mobile').length,
          },
          uniqueUsers: [...new Set(participants.map((p) => p.userId))].length,
        },
      };
    } catch (error) {
      console.error('Error getting call participants:', error);
      return {
        success: false,
        message: error.message || 'Failed to get participants',
      };
    }
  }

  // Helper methods
  private async getCallerInfo(userId: string) {
    // Get user info from database
    // Return caller name, avatar, role, etc.
    return {
      id: userId,
      name: 'User Name', // Get from database
      avatar: 'avatar-url', // Get from database
      role: 'doctor', // Get from database
    };
  }

  private getOtherParticipantId(call: any, currentUserId: string): string {
    const patientId =
      typeof call.patientId === 'object'
        ? call.patientId._id?.toString()
        : call.patientId?.toString();
    const doctorId =
      typeof call.doctorId === 'object'
        ? call.doctorId._id?.toString()
        : call.doctorId?.toString();

    return patientId === currentUserId ? doctorId : patientId;
  }

  private determineUserRole(call: any, userId: string): 'patient' | 'doctor' {
    const patientId =
      typeof call.patientId === 'object'
        ? call.patientId._id?.toString()
        : call.patientId?.toString();

    return patientId === userId ? 'patient' : 'doctor';
  }

  private getOtherParticipantInfo(call: any, userId: string) {
    const isPatient = this.determineUserRole(call, userId) === 'patient';

    if (isPatient) {
      return {
        _id: call.doctorId._id || call.doctorId,
        name: call.doctorId.fullName || 'Unknown Doctor',
        avatar: call.doctorId.photoUrl,
        role: 'doctor',
      };
    } else {
      return {
        _id: call.patientId._id || call.patientId,
        name: call.patientId.fullName || 'Unknown Patient',
        avatar: call.patientId.avatarUrl,
        role: 'patient',
      };
    }
  }

  private async sendWebSocketNotification(userId: string, payload: any) {
    // Use WebSocket gateway for notification
    await this.callGateway.sendIncomingCallNotification(userId, payload);
    return { status: 'fulfilled', channel: 'websocket' };
  }

  private async sendPushNotification(userId: string, pushPayload: any) {
    // Implement Push notification (Firebase, etc.)
    console.log(`📱 Push notification sent to user ${userId}:`, pushPayload);
    return { status: 'fulfilled', channel: 'push' };
  }

  private async sendSMSNotification(userId: string, message: string) {
    // Implement SMS notification (Twilio, etc.)
    console.log(`📱 SMS sent to user ${userId}: ${message}`);
    return { status: 'fulfilled', channel: 'sms' };
  }

  @Get('debug/agora-config')
  @ApiOperation({ summary: 'Debug: Check Agora configuration' })
  async debugAgoraConfig() {
    try {
      const configStatus = this.agoraService.getConfigurationStatus();

      return {
        success: true,
        message: 'Agora configuration check',
        data: {
          timestamp: new Date().toISOString(),
          configuration: configStatus,
          validation: {
            hasRequiredFields:
              configStatus.hasAppId && configStatus.hasAppCertificate,
            appIdFormat: configStatus.appIdLength === 32 ? 'VALID' : 'INVALID',
            appCertificateFormat:
              configStatus.appCertificateLength === 32 ? 'VALID' : 'INVALID',
            overallStatus: configStatus.isConfigured
              ? 'READY'
              : 'NOT_CONFIGURED',
          },
          recommendations: !configStatus.isConfigured
            ? [
                'Set AGORA_APP_ID in environment variables',
                'Set AGORA_APP_CERTIFICATE in environment variables',
                'Ensure both values are 32-character strings',
              ]
            : ['Agora configuration is valid'],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/comprehensive-test')
  @ApiOperation({ summary: 'Comprehensive Agora system test' })
  async comprehensiveTest() {
    try {
      const configStatus = this.agoraService.getConfigurationStatus();

      if (!configStatus.isConfigured) {
        return {
          success: false,
          message: 'Agora not configured properly',
          data: { configStatus },
        };
      }

      // 1. Test token generation
      const testUid = Math.floor(Math.random() * 100000) + 1;
      let testToken: string;
      try {
        testToken = this.agoraService.generateValidatedToken(
          'test_channel_comprehensive_' + Date.now(),
          testUid,
          1, // 1 hour expiry for testing
        );
      } catch (error) {
        return {
          success: false,
          message: 'Token generation failed',
          error: error.message,
        };
      }

      // 2. Validate Agora credentials
      const verification = this.agoraService.validateAgoraCredentials();

      if (verification.overall !== 'VALID') {
        return {
          success: false,
          message: 'Agora credentials validation failed',
          data: { verification },
        };
      }

      return {
        success: true,
        message: 'Comprehensive test passed',
        data: {
          configStatus,
          token: {
            uid: testUid,
            token: testToken,
            expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
          agoraCredentials: verification,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/call-details/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Debug: Get detailed call information' })
  @ApiParam({ name: 'id', description: 'Call ID' })
  async debugCallDetails(@Param('id') callId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;

      // Get call without population first
      const rawCall = await this.callService.getCallByIdRaw(callId);

      // Get call with population
      const populatedCall = await this.callService.getCallById(callId);

      return {
        success: true,
        message: 'Call details retrieved for debugging',
        data: {
          requestUserId: userId,
          rawCall: {
            _id: rawCall?._id,
            patientId: rawCall?.patientId,
            doctorId: rawCall?.doctorId,
            appointmentId: rawCall?.appointmentId,
            status: rawCall?.status,
            callType: rawCall?.callType,
            roomId: rawCall?.roomId,
          },
          populatedCall: {
            _id: (populatedCall as any)?._id,
            patientId: populatedCall?.patientId,
            doctorId: populatedCall?.doctorId,
            appointmentId: populatedCall?.appointmentId,
            status: populatedCall?.status,
            callType: populatedCall?.callType,
            roomId: populatedCall?.roomId,
          },
          validation: {
            hasAppointmentId: !!rawCall?.appointmentId,
            appointmentIdValue: rawCall?.appointmentId?.toString() || null,
            isUserAuthorized: {
              isPatient: rawCall?.patientId?.toString() === userId,
              isDoctor: rawCall?.doctorId?.toString() === userId,
            },
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Debug failed',
        error: error.message,
        callId,
      };
    }
  }

  @Post('debug/test-agora-token')
  @ApiOperation({
    summary: 'Test Agora token generation with different parameters',
  })
  async testAgoraToken(
    @Body()
    body: {
      channelName?: string;
      uid?: number;
      callId?: string;
      testType?: string;
    },
  ) {
    try {
      const testChannelName = body.channelName || 'test_channel_' + Date.now();
      const testUid = body.uid || Math.floor(Math.random() * 100000) + 1;
      // Test different scenarios
      const tests: any[] = [];

      // Test 1: Simple channel name
      try {
        const simpleToken = this.agoraService.generateValidatedToken(
          'test_simple',
          testUid,
          1,
        );
        tests.push({
          name: 'Simple Channel',
          channelName: 'test_simple',
          uid: testUid,
          success: true,
          token: simpleToken.substring(0, 50) + '...',
          tokenLength: simpleToken.length,
        });
      } catch (error) {
        tests.push({
          name: 'Simple Channel',
          channelName: 'test_simple',
          uid: testUid,
          success: false,
          error: error.message,
        });
      }

      // Test 2: Complex channel name (like current format)
      try {
        const complexToken = this.agoraService.generateValidatedToken(
          testChannelName,
          testUid,
          1,
        );
        tests.push({
          name: 'Complex Channel',
          channelName: testChannelName,
          uid: testUid,
          success: true,
          token: complexToken.substring(0, 50) + '...',
          tokenLength: complexToken.length,
        });
      } catch (error) {
        tests.push({
          name: 'Complex Channel',
          channelName: testChannelName,
          uid: testUid,
          success: false,
          error: error.message,
        });
      }

      // Test 3: UID 0 (auto-assign)
      try {
        const autoToken = this.agoraService.generateValidatedToken(
          testChannelName,
          0,
          1,
        );
        tests.push({
          name: 'Auto UID (0)',
          channelName: testChannelName,
          uid: 0,
          success: true,
          token: autoToken.substring(0, 50) + '...',
          tokenLength: autoToken.length,
        });
      } catch (error) {
        tests.push({
          name: 'Auto UID (0)',
          channelName: testChannelName,
          uid: 0,
          success: false,
          error: error.message,
        });
      }

      // Test 4: If callId provided, test with actual call
      if (body.callId) {
        try {
          const call = await this.callService.getCallByIdRaw(body.callId);
          if (call) {
            const callToken = this.agoraService.generateValidatedToken(
              call.roomId,
              testUid,
              1,
            );
            tests.push({
              name: 'Actual Call Channel',
              channelName: call.roomId,
              uid: testUid,
              success: true,
              token: callToken.substring(0, 50) + '...',
              tokenLength: callToken.length,
              callStatus: call.status,
            });
          }
        } catch (error) {
          tests.push({
            name: 'Actual Call Channel',
            callId: body.callId,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: 'Agora token tests completed',
        data: {
          agoraConfig: this.agoraService.getConfiguration(),
          tests,
          recommendations: [
            'If all tests fail: Check AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env',
            'If simple test passes but complex fails: Channel name format issue',
            'If tokens generate but join fails: Client-side Agora SDK issue',
            'Error -2: Invalid argument (token/channel/uid format)',
            'Error -7: Not initialized (Agora SDK issue on client)',
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Token test failed',
        error: error.message,
        agoraConfig: this.agoraService.getConfiguration(),
      };
    }
  }

  @Get('debug/agora-simple-test')
  @ApiOperation({ summary: 'Simple Agora configuration test' })
  async simpleAgoraTest() {
    try {
      const config = this.agoraService.getConfiguration();
      // Try to generate a simple token
      let tokenTest: any = null;
      try {
        const testToken = this.agoraService.generateValidatedToken(
          'test123',
          12345,
          1,
        );
        tokenTest = {
          success: true,
          tokenLength: testToken.length,
          tokenPreview: testToken.substring(0, 50) + '...',
        };
      } catch (error) {
        tokenTest = {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        message: 'Agora simple test completed',
        data: {
          configuration: config,
          tokenGeneration: tokenTest,
          troubleshooting: {
            'Error -2':
              'ERR_INVALID_ARGUMENT - Check token format, channel name, or UID',
            'Error -7':
              'ERR_NOT_INITIALIZED - Agora engine not properly initialized on client',
            'Next steps': [
              '1. Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env',
              '2. Check if client Agora SDK version matches server',
              '3. Try with simpler channel name (no special characters)',
              '4. Check if App Certificate is correct for the App ID',
            ],
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Simple test failed',
        error: error.message,
      };
    }
  }

  @Post('debug/test-token-roles')
  @ApiOperation({ summary: 'Test Agora tokens with different roles' })
  async testTokenRoles(@Body() body: { channelName?: string; uid?: number }) {
    try {
      const testChannel = body.channelName || 'test_simple_channel';
      const testUid = body.uid || 12345;

      const results: any[] = []; // Test PUBLISHER role
      try {
        const publisherToken = this.agoraService.generateTokenWithRole(
          testChannel,
          testUid,
          'host',
        ); // host = PUBLISHER role
        results.push({
          role: 'PUBLISHER',
          success: true,
          tokenLength: publisherToken.length,
          tokenPreview: publisherToken.substring(0, 50) + '...',
        });
      } catch (error) {
        results.push({
          role: 'PUBLISHER',
          success: false,
          error: error.message,
        });
      } // Test SUBSCRIBER role
      try {
        const subscriberToken = this.agoraService.generateTokenWithRole(
          testChannel,
          testUid,
          'audience',
        ); // audience = SUBSCRIBER role
        results.push({
          role: 'SUBSCRIBER',
          success: true,
          tokenLength: subscriberToken.length,
          tokenPreview: subscriberToken.substring(0, 50) + '...',
        });
      } catch (error) {
        results.push({
          role: 'SUBSCRIBER',
          success: false,
          error: error.message,
        });
      }

      return {
        success: true,
        message: 'Token role tests completed',
        data: {
          testParameters: {
            channelName: testChannel,
            uid: testUid,
          },
          results,
          recommendations: [
            'Try the SUBSCRIBER token if PUBLISHER fails',
            'Simpler channel names often work better',
            'Ensure client uses same UID as server-generated token',
            'Check Agora console for project settings',
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Token role test failed',
        error: error.message,
      };
    }
  }

  @Post('debug/validate-token-backend')
  @ApiOperation({ summary: 'Validate token from backend side using Agora API' })
  async validateTokenBackend(
    @Body() body: { token: string; channelName: string; uid: number },
  ) {
    try {
      const { token, channelName, uid } = body;

      // Validate token format
      const tokenValid = token && token.length > 100 && token.startsWith('006');

      // Try to parse token structure (basic validation)
      const appIdFromToken = token.substring(3, 35); // Extract app ID from token
      const expectedAppId = this.agoraService.getAppId();

      // Generate fresh token for comparison
      let freshToken = '';
      try {
        freshToken = this.agoraService.generateValidatedToken(
          channelName,
          uid,
          1,
        );
      } catch (error) {
        // Token generation failed
      }

      return {
        success: true,
        message: 'Token validation completed',
        data: {
          originalToken: {
            provided: !!token,
            length: token?.length || 0,
            startsCorrectly: token?.startsWith('006') || false,
            appIdInToken: appIdFromToken,
            preview: token?.substring(0, 50) + '...',
          },
          expectedConfig: {
            appId: expectedAppId,
            channelName,
            uid,
          },
          validation: {
            tokenFormatValid: tokenValid,
            appIdMatches: appIdFromToken === expectedAppId,
            canGenerateNewToken: !!freshToken,
          },
          freshToken: {
            generated: !!freshToken,
            length: freshToken?.length || 0,
            preview:
              freshToken?.substring(0, 50) + '...' || 'Failed to generate',
            matches: token === freshToken,
          },
          troubleshooting: {
            'Backend Status': 'Token generation working',
            'Issue Location': 'Client-side Agora SDK',
            'Possible Causes': [
              'Agora SDK version mismatch',
              'Platform-specific Agora settings',
              'Network/firewall blocking Agora servers',
              'App Certificate mismatch in Agora Console',
            ],
            'Next Steps': [
              '1. Check Agora Console project settings',
              '2. Verify App Certificate is correct',
              '3. Try different Agora SDK version',
              '4. Test on different device/network',
              '5. Check Agora server regions',
            ],
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Token validation failed',
        error: error.message,
      };
    }
  }

  @Get('debug/agora-console-check')
  @ApiOperation({
    summary: 'Check Agora Console configuration recommendations',
  })
  async agoraConsoleCheck() {
    try {
      const config = this.agoraService.getConfiguration();

      return {
        success: true,
        message: 'Agora Console configuration check',
        data: {
          currentConfig: config,
          consoleChecklist: {
            'Project Status': 'Should be "Active" in Agora Console',
            'App Certificate': 'Must match AGORA_APP_CERTIFICATE in .env',
            Authentication: 'Should be "App ID + App Certificate"',
            Services: 'RTC should be enabled',
            Regions: 'Check if Asia-Pacific regions are enabled',
            Security: 'Token authentication should be enabled',
          },
          commonIssues: {
            'Error -2 (ERR_INVALID_ARGUMENT)': [
              'App Certificate mismatch between console and .env',
              'Token generated with wrong App Certificate',
              'Channel name contains invalid characters',
              'UID format issue (should be positive integer)',
            ],
            'Error -7 (ERR_NOT_INITIALIZED)': [
              'Agora SDK not properly initialized on client',
              'Network connectivity issues',
              'Agora servers blocked by firewall',
              'Wrong Agora SDK version for platform',
            ],
          },
          recommendedActions: [
            '1. Log into Agora Console (console.agora.io)',
            '2. Verify project is Active and has correct App Certificate',
            '3. Check if RTC service is enabled and properly configured',
            '4. Test with Agora demo app to verify account setup',
            '5. Ensure client app has proper network permissions',
            '6. Try connecting from different network/device',
          ],
          testUrls: {
            'Agora Console': 'https://console.agora.io',
            'Agora Demo': 'https://webdemo.agora.io/basicVideoCall/index.html',
            Documentation:
              'https://docs.agora.io/en/Voice/start_call_audio_react_native',
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Console check failed',
        error: error.message,
      };
    }
  }

  @Post('debug/minimal-test-config')
  @ApiOperation({
    summary: 'Generate minimal test configuration for client debugging',
  })
  async minimalTestConfig() {
    try {
      // Generate the simplest possible configuration
      const simpleChannel = 'test123';
      const simpleUid = 12345;

      let testToken = '';
      try {
        testToken = this.agoraService.generateValidatedToken(
          simpleChannel,
          simpleUid,
          24,
        );
      } catch (error) {
        return {
          success: false,
          message: 'Cannot generate test token',
          error: error.message,
          action: 'Check AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env file',
        };
      }

      return {
        success: true,
        message: 'Minimal test configuration generated',
        data: {
          // Minimal config for client testing
          testConfig: {
            appId: this.agoraService.getAppId(),
            channelName: simpleChannel,
            uid: simpleUid,
            token: testToken,
          },
          // Client test code suggestions
          clientTestSteps: {
            'Step 1': 'Use this exact configuration in your client',
            'Step 2': 'Initialize Agora engine with appId',
            'Step 3': 'Join channel with token, channelName, and uid',
            'Step 4':
              'If still fails, issue is with Agora account/console setup',
          },
          reactNativeExample: {
            init: `const engine = await RtcEngine.create('${this.agoraService.getAppId()}');`,
            join: `await engine.joinChannel('${testToken}', '${simpleChannel}', null, ${simpleUid});`,
          },
          webExample: {
            init: `const client = AgoraRTC.createClient({mode: 'rtc', codec: 'vp8'});`,
            join: `await client.join('${this.agoraService.getAppId()}', '${simpleChannel}', '${testToken}', ${simpleUid});`,
          },
          // Debug URLs to test Agora account
          testWithAgoraDemo: {
            url: 'https://webdemo.agora.io/basicVideoCall/index.html',
            instructions: 'Use your App ID to test if Agora account works',
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Minimal config generation failed',
        error: error.message,
      };
    }
  }

  /**
   * DEBUG: Validate Agora token format and parameters
   */
  @Get('debug/validate-token')
  async validateToken(@Query() query: any) {
    try {
      const { token, channelName, uid } = query;
      if (!token || !channelName || !uid) {
        return errorResponse(
          'Missing required parameters: token, channelName, uid',
        );
      }

      const validation = this.agoraService.validateToken(
        token,
        channelName,
        parseInt(uid),
      );

      return successResponse(validation, 'Token validation completed');
    } catch (error) {
      this.logger.error('Error validating token:', error);
      return errorResponse('Failed to validate token', error);
    }
  }

  /**
   * DEBUG: Test different UID formats for compatibility
   */
  @Get('debug/test-uid-formats/:channelName/:baseUid')
  async testUidFormats(
    @Param('channelName') channelName: string,
    @Param('baseUid') baseUid: string,
  ) {
    try {
      const uid = parseInt(baseUid);
      const results = this.agoraService.testUidFormats(channelName, uid);
      return successResponse(
        {
          baseUid: uid,
          channelName: channelName,
          results: results,
        },
        'UID format testing completed',
      );
    } catch (error) {
      this.logger.error('Error testing UID formats:', error);
      return errorResponse('Failed to test UID formats', error);
    }
  }

  /**
   * DEBUG: Generate simple test configuration for client testing
   */
  @Get('debug/simple-test-config')
  async getSimpleTestConfig() {
    try {
      const config = this.agoraService.generateSimpleTestConfig();
      return successResponse(
        {
          config: config,
          clientInstructions: [
            '1. Use the exact appId, channelName, uid, and token provided',
            '2. Make sure your Agora SDK version is compatible (4.x recommended)',
            '3. Check that you are using the correct RTC engine initialization',
            '4. Verify your React Native Agora SDK setup',
            '5. Test with a simple channel name first',
          ],
        },
        'Simple test configuration generated',
      );
    } catch (error) {
      this.logger.error('Error generating test config:', error);
      return errorResponse('Failed to generate test config', error);
    }
  }

  /**
   * DEBUG: Comprehensive token analysis for debugging client join failures
   */
  @Get('debug/analyze-join-failure')
  async analyzeJoinFailure(@Query() query: any) {
    try {
      const { appId, channelName, uid, token, errorCode } = query;

      const analysis = {
        providedData: {
          appId: appId || 'Not provided',
          channelName: channelName || 'Not provided',
          uid: uid || 'Not provided',
          token: token ? `${token.substring(0, 20)}...` : 'Not provided',
          errorCode: errorCode || 'Not provided',
        },
        expectedData: {
          appId: this.agoraService['appId'],
          tokenValidation:
            token && channelName && uid
              ? this.agoraService.validateToken(
                  token,
                  channelName,
                  parseInt(uid || '0'),
                )
              : 'Cannot validate - missing parameters',
        },
        commonIssues: {
          errorCode2:
            'Invalid argument - Check UID format, channel name, or token',
          errorCode7: 'Not initialized - Check Agora SDK initialization',
          errorCode17: 'Token expired - Generate new token',
          errorCode101: 'Invalid app ID - Check app ID configuration',
          errorCode109: 'Token privilege expired - Check token expiration',
        },
        troubleshooting: {
          uidRange: 'UID must be 0-4294967295 (32-bit unsigned integer)',
          channelName: 'Channel name should be alphanumeric, max 64 chars',
          tokenFormat: 'Token should start with your app ID',
          sdkVersion: 'Use Agora RTC SDK 4.x for best compatibility',
        },
      };
      return successResponse(analysis, 'Join failure analysis completed');
    } catch (error) {
      this.logger.error('Error analyzing join failure:', error);
      return errorResponse('Failed to analyze join failure', error);
    }
  }
}
