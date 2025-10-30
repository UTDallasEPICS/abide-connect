import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true, 
  },
<<<<<<< HEAD
  users:{
    modelName: "volunteers"
  }
=======
>>>>>>> 42-feature-create-a-basic-login-page-profile-page-for-testing-only
});