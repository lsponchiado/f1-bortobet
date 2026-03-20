import 'next-auth';

declare module 'next-auth' {
  interface User {
    username?: string;
    role?: string;
  }

  interface Session {
    user: User & {
      id: string;
      username?: string;
      role?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username?: string;
    role?: string;
  }
}
