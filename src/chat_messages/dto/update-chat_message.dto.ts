import { PartialType } from '@nestjs/swagger';
import { CreateChatMessageDto } from './create-chat_message.dto';

export class UpdateChatMessageDto extends PartialType(CreateChatMessageDto) {}
