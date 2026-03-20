import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.username = token.username as string | undefined;
        session.user.role = token.role as string | undefined;
        session.user.id = token.sub || (token.id as string);
      }
      return session;
    },
  },
  providers: [], 
} satisfies NextAuthConfig;