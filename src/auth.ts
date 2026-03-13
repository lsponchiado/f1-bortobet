import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // On sign-in, persist extra fields
      if (user) {
        token.username = (user as any).username;
        token.id = user.id;
        token.role = (user as any).role;
        return token;
      }
      // On every subsequent request, verify user still exists in DB
      if (token.id) {
        const exists = await prisma.user.findUnique({
          where: { id: Number(token.id) },
          select: { id: true, role: true },
        });
        if (!exists) return { ...token, id: undefined, sub: undefined };
        token.role = exists.role;
      }
      return token;
    },
  },
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
          role: user.role,
        };
      },
    }),
  ],
});