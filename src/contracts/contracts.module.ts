import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { AssistantModule } from '../assistant/assistant.module';

@Module({
  imports: [AssistantModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
