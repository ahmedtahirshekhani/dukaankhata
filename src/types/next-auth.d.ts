import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string;
    company?: string;
  }

  interface Session {
    user: User & {
      id: string;
      company?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name?: string;
    company?: string;
  }
}
