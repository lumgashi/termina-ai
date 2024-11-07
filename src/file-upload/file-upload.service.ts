import { BadRequestException, Injectable } from '@nestjs/common';
//import * as pdfParse from 'pdf-parse';
// eslint-disable-next-line @typescript-eslint/no-require-imports
//const mammoth = require('mammoth');
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from 'src/assistant/assistant.service';

@Injectable()
export class FileUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private config: ConfigService,
    private readonly openai: AssistantService,
  ) {}
  async create(file: Express.Multer.File) {
    //create the file in OpenAI
    const uploadedFile = await this.openai.createFile(file);
    if (!uploadedFile) {
      throw new BadRequestException(
        'Failed to upload file, please try again later',
      );
    }
    //create a new message in the thread
    const newMessage = await this.openai.uploadFileInThread(uploadedFile.id);
    if (!newMessage) {
      throw new BadRequestException(
        'Failed to create new message, please try again later',
      );
    }

    //create a `run` without streaming
    const run = await this.openai.createRunWithoutStreaming(newMessage.id);
    return run;
  }
}
