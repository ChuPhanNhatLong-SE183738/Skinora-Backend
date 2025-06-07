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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CallService } from './call.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse, errorResponse } from '../helper/response.helper';
import { InitiateCallDto, AddCallNotesDto } from './dto/initiate-call.dto';

@ApiTags('calls')
@Controller('call')
export class CallController {
  constructor(private readonly callService: CallService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a video/voice call with Agora.io' })
  async initiateCall(@Request() req, @Body() initiateCallDto: InitiateCallDto) {
    try {
      const patientId = req.user.sub || req.user.id;
      const result = await this.callService.initiateCall(
        patientId,
        initiateCallDto.doctorId,
        initiateCallDto.callType,
        initiateCallDto.appointmentId,
      );
      return successResponse(
        result,
        'Call initiated successfully with Agora tokens',
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

  // Other existing endpoints...
}
