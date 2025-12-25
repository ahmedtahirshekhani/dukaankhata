import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/mongodb";

// Shared NextAuth options (v4-compatible)
export const authOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const usersCollection = await getCollection(COLLECTIONS.USERS);
          const userData = await usersCollection.findOne({
            email: credentials.email,
          });

          if (!userData) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            userData.password_hash
          );

          if (!passwordMatch) {
            return null;
          }

          const user = {
            id: userData._id.toString(),
            email: userData.email,
            name: userData.name,
            company: userData.company_name,
          };
          return user;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }: any) {
      // On login, seed token from user
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.company = user.company;
      }

      // Always refresh token fields from DB so updated profile (name/company) reflects after updates
      if (token?.id) {
        try {
          const usersCollection = await getCollection(COLLECTIONS.USERS);
          const dbUser = await usersCollection.findOne({ _id: toObjectId(token.id as string) });
          if (dbUser) {
            token.name = dbUser.name;
            token.company = dbUser.company_name;
            token.email = dbUser.email;
          }
        } catch (err) {
          console.error("jwt callback user fetch error", err);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).company = token.company as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt" as const,
    // Keep users signed in for 30 days
    maxAge: 30 * 24 * 60 * 60, // 30 days
    // Refresh the JWT periodically to achieve sliding sessions while active
    updateAge: 24 * 60 * 60, // refresh token if it's older than 24h
  },
  // Ensure the session cookie persists across browser restarts and matches maxAge
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days (align with session.maxAge)
      },
    },
  },
};

// v4 helper to get the current session server-side
export async function auth(): Promise<import("next-auth").Session | null> {
  return getServerSession(authOptions as any);
}
