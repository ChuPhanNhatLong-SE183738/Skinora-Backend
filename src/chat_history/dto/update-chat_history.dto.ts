import { PartialType } from '@nestjs/swagger';
import { CreateChatHistoryDto } from './create-chat_history.dto';

export class UpdateChatHistoryDto extends PartialType(CreateChatHistoryDto) {}
