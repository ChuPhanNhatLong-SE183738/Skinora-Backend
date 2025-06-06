import { Test, TestingModule } from '@nestjs/testing';
import { ChatHistoryController } from './chat_history.controller';
import { ChatHistoryService } from './chat_history.service';

describe('ChatHistoryController', () => {
  let controller: ChatHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatHistoryController],
      providers: [ChatHistoryService],
    }).compile();

    controller = module.get<ChatHistoryController>(ChatHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
