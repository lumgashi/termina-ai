import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { ConfigModule } from '@nestjs/config';
import { AssistantModule } from '../assistant/assistant.module';

@Module({
  imports: [ConfigModule, AssistantModule],
  controllers: [FileUploadController],
  providers: [FileUploadService],
})
export class FileUploadModule {}
