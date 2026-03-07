import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = (user as any).username;
        token.id = user.id; // Força o ID a entrar no token
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).username = token.username;
        session.user.id = token.sub || (token.id as string); // Garante que o ID vá para a página
      }
      return session;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;