import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const { identifier, password } = credentials;
        if (!identifier || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier as string },
              { username: identifier as string },
            ],
          },
        });

        if (!user) return null;

        // Bcrypt e Prisma rodam aqui (no servidor normal), não no Proxy
        const isPasswordValid = await bcrypt.compare(
          password as string,
          user.password
        );

        if (!isPasswordValid) return null;

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          username: user.username,
        };
      },
    }),
  ],
});