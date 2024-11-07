import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAIApi, { OpenAI } from 'openai';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import { REQUEST } from '@nestjs/core';
import { RequestWithUser } from 'src/utils/types';
import { Run } from 'openai/resources/beta/threads/runs/runs';
import { MessagesPage, Message } from 'openai/resources/beta/threads/messages';
import { Thread } from 'openai/resources/beta/threads/threads';

@Injectable()
export class AssistantService {
  private openai: OpenAIApi;
  private assistant: any;
  constructor(
    private config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: RequestWithUser,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow('OPENAI_API_KEY'), // This is the default and can be omitted
    });

    // Creating the Assistant by defining its custom instructions and picking the gpt-4o model with file_search tool, which allows the Assistant to gather infomation,
    //and be more knowledge, outside its model
    this.assistant = this.openai.beta.assistants.create({
      name: 'Contract Simplifier Assistant',
      instructions: ` You are a professional contract simplifier. This what you will do :
        - Automatic Detection: identify document type (e.g., lease, employment, or service contract) and provide a tailored analysis based on this classification. Content Analysis & Summarization
        - Legal Language Simplification: detect and simplify legal jargon, turning dense contract language into plain, easy-to-read text.
        - Section Summarization: break down the contract into sections (e.g., payment terms, confidentiality, liabilities, termination conditions) and provide summaries for each.
        - Highlight Key Clauses: Critical clauses, such as payment schedules, non-compete, termination clauses, and liability limits, are highlighted with visual cues (e.g., icons or color coding) for quick reference.
        - Obligation & Deadline Tracker
        - Automatic Extraction: Dates, milestones, renewal terms, and deadlines are automatically extracted and organized into a timeline view or calendar, helping users avoid missed obligations.
        - Risk Analysis: Analyze and flag potential risks, such as high penalties for breach of contract or restrictive termination clauses, and provides a brief explanation.
        -Recommendations: Based on industry standards and best practices, the platform could suggest language modifications or risk-mitigation strategies (e.g., "Consider adding a mutual termination clause").
      `,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
      temperature: 0.1,
    });
  }

  async createFile(file: Express.Multer.File) {
    // Create a read stream from the file
    const fileStream = fs.createReadStream(file.path);

    // Upload the file to OpenAI
    const uploadedFile = await this.openai.files.create({
      file: fileStream,
      purpose: 'assistants',
    });

    return uploadedFile;
  }

  async uploadFileInThread(file: any): Promise<Thread> {
    const userId = this.request.user.id;
    const thread = await this.openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: `
        Please analyze and simplify the attached document. I need:
        - Identify document type (e.g., lease, employment, or service contract) and provide a tailored analysis based on this classification
        - A concise summary capturing the main points.
        - Section Summarization: It breaks down the contract into sections (e.g., payment terms, confidentiality, liabilities, termination conditions) and provides summaries for each.
        - A list of key obligations and responsibilities.
        - An outline of potential risks or drawbacks.
        - Any important deadlines, dates, or conditions.
        - An easy-to-understand, step-by-step breakdown of actions required.
        - A bulleted list of questions or items to clarify (if any).
        -Highlight Key Clauses: Critical clauses, such as payment schedules, non-compete, termination clauses, and liability limits, are highlighted with visual cues (e.g., icons or color coding) for quick reference.
        
        Ensure clarity and accessibility for a non-expert audience.
      `,
          attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }],
        },
      ],
      metadata: {
        userId: userId,
      },
    });

    try {
      const contract = await this.prisma.contract.create({
        data: {
          creator: {
            connect: { id: userId },
          },
        },
      });

      const updatedMetadata = thread.metadata as Prisma.JsonValue;
      updatedMetadata['contractId'] = contract.id;
      await this.prisma.thread.create({
        data: {
          threadId: thread.id,
          creator: {
            connect: { id: userId },
          },
          contract: {
            connect: { id: contract.id },
          },
          metadata: thread.metadata as Prisma.JsonValue,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
    return thread;
  }

  async createRunWithoutStreaming(threadId: string): Promise<Run> {
    const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: this.assistant.id,
    });

    const messages = await this.openai.beta.threads.messages.list(threadId, {
      run_id: run.id,
    });

    const message = messages.data.pop()!;
    if (message.content[0].type === 'text') {
      const { text } = message.content[0];
      const { annotations } = text;
      const citations: string[] = [];

      let index = 0;
      for (const annotation of annotations) {
        //File citations are created by the file_search tool and define references to a specific file that was,
        //uploaded and used by the Assistant to generate the response.
        if (annotation.type === 'file_citation') {
          text.value = text.value.replace(annotation.text, `[${index}]`);
          const { file_citation } = annotation;

          const citedFile = await this.openai.files.retrieve(
            file_citation.file_id,
          );
          citations.push(`[${index}] ${citedFile.filename}`);
        }
        index++;
      }

      return run;
    }
  }

  async createUserMessage(
    threadId: string,
    userPrompt: string,
  ): Promise<Message> {
    //create the message(user prompt) in the thread
    try {
      const threadMessages = await this.openai.beta.threads.messages.create(
        threadId,
        {
          role: 'user',
          content: userPrompt,
        },
      );

      return threadMessages;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async createRun(threadId: string): Promise<Run> {
    try {
      const run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: this.assistant.id,
      });
      return run;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getAllMessagesInThread(
    threadId: string,
    runId: string,
  ): Promise<MessagesPage> {
    try {
      const messages = await this.openai.beta.threads.messages.list(threadId, {
        run_id: runId,
      });
      return messages;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
