import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractWithThread, RequestWithUser } from '../utils/types';
import { AssistantService } from '../assistant/assistant.service';
import { REQUEST } from '@nestjs/core';
import { MessagesPage } from 'openai/resources/beta/threads/messages';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: AssistantService,
    @Inject(REQUEST) private readonly request: RequestWithUser,
  ) {}
  async findAll() {
    const contracts = await this.prisma.contract.findMany({
      where: {
        creatorId: this.request.user.id,
      },
    });

    return contracts;
  }

  async findOne(id: string): Promise<ContractWithThread> {
    try {
      const contract = await this.prisma.contract.findUnique({
        where: {
          id,
        },
        include: {
          thread: true,
        },
      });

      return contract;
    } catch (error) {
      throw new NotFoundException('Contract not found', { description: error });
    }
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<MessagesPage> {
    const userId = this.request.user.id;
    const contract = await this.prisma.contract.findUnique({
      where: {
        id,
      },
      include: {
        thread: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.creatorId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this contract',
      );
    }

    try {
      const { userPrompt } = updateContractDto;
      //create the message
      await this.openai.createUserMessage(contract.thread.id, userPrompt);

      // create a run
      const run = await this.openai.createRun(contract.thread.id);

      // get the chat or messages inside the thread
      const threadMessages = await this.openai.getAllMessagesInThread(
        contract.thread.id,
        run.id,
      );

      return threadMessages;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.contract.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
