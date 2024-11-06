import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// the application will have only one assistant
export const createAssistant = async () => {
  const assitantExists = await prisma.assistant.findFirst();
  console.log('assitantExists', assitantExists);
  if (!assitantExists) {
    return await prisma.assistant.create({
      data: {
        assistantId: '1',
      },
    });
  }
};
