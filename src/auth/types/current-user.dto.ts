import { Role } from '@prisma/client';

export type CurrentUser = {
  id: string;
  role: Role;
};
