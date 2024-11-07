import { Contract, Thread } from '@prisma/client';

export type ContractWithThread = Contract & {
  thread: Thread;
};
