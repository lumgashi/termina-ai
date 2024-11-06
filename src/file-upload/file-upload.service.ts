import { BadRequestException, Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth');
import OpenAIApi, { OpenAI } from 'openai';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { chunkText } from 'src/utils/functions';

@Injectable()
export class FileUploadService {
  private openai: OpenAIApi;

  constructor(
    private readonly prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow('OPENAI_API_KEY'), // This is the default and can be omitted
    });
  }
  async create(file: Express.Multer.File) {
    let textContent: string;

    if (file.mimetype === 'application/pdf') {
      // PDF file handling
      const data = await pdfParse(file.buffer);
      textContent = data.text;
    } else if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // DOCX file handling
      const data = await mammoth.extractRawText({ buffer: file.buffer });
      textContent = data.value;
    } else {
      throw new BadRequestException('Unsupported file type');
    }
    console.log('textContent', textContent);
    return this.processTextContent(textContent);
  }

  async summarizeChunk(chunk: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'Simplify the following contract text.' },
        { role: 'user', content: chunk },
      ],
    });
    return response.choices[0].message.content;
  }

  async processTextContent(textContent: string) {
    const maxTokens = 1500; // Adjust based on GPT-4 token limit
    const chunks = chunkText(textContent, maxTokens);

    const summaries = [];
    for (const chunk of chunks) {
      const summary = await this.summarizeChunk(chunk);
      summaries.push(summary);
    }

    return summaries.join('\n\n');
  }

  findAll() {
    return `This action returns all fileUpload`;
  }

  findOne(id: number) {
    return `This action returns a #${id} fileUpload`;
  }

  remove(id: number) {
    return `This action removes a #${id} fileUpload`;
  }
}
