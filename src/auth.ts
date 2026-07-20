import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";

// Determine session max age in seconds from environment variable, defaulting to 30 days
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS) || 30;
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;

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

          // Check if account is deleted
          if (userData.isDeleted) {
            throw new Error("ACCOUNT_DELETED");
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            userData.password_hash
          );

          if (!passwordMatch) {
            return null;
          }

          const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
          const subscription = await subscriptionsCollection.findOne(
            { user_id: userData._id },
            { sort: { created_at: -1 } }
          );

          if (subscription && subscription.status === "login_blocked") {
            throw new Error("LOGIN_BLOCKED");
          }

          // Handle Session Masking for Staff
          let role = "owner";
          let ownerId = userData._id.toString();
          let staffId = null;

          if (userData.role === "staff" && userData.owner_id) {
            role = "staff";
            ownerId = userData.owner_id.toString();
            staffId = userData._id.toString();
          }

          const user = {
            id: ownerId,
            staff_id: staffId,
            role: role,
            email: userData.email,
            name: userData.name,
            company: userData.company_name,
          };
          return user;
        } catch (error: any) {
          if (error.message === "ACCOUNT_DELETED" || error.message === "LOGIN_BLOCKED") {
            throw error;
          }
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
        token.staff_id = (user as any).staff_id;
        token.role = (user as any).role;
        token.email = user.email;
        token.name = user.name;
        token.company = user.company;
      }

      if (token?.id) {
        try {
          const usersCollection = await getCollection(COLLECTIONS.USERS);
          // If staff, look up by staff_id, else by owner id
          const searchId = token.role === "staff" ? token.staff_id : token.id;
          const dbUser = await usersCollection.findOne({ _id: toObjectId(searchId as string) });
          if (dbUser) {
            token.name = dbUser.name;
            // Staff might not have company_name, use the owner's company if needed,
            // but for now stick to dbUser or fall back
            token.company = dbUser.company_name || token.company; 
            token.email = dbUser.email;
          }

          // Load permissions if staff
          if (token.role === "staff" && token.staff_id) {
            const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
            const rolePermsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
            const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);

            const userRoles = await userRolesColl.find({ user_id: toObjectId(token.staff_id as string) }).toArray();
            const roleIds = userRoles.map(ur => ur.role_id);

            const rolePerms = await rolePermsColl.find({ role_id: { $in: roleIds } }).toArray();
            const permissionIds = rolePerms.map(rp => rp.permission_id);

            const perms = await permsColl.find({ _id: { $in: permissionIds } }).toArray();
            token.permissions = perms.map(p => `${p.module_code}.${p.action}`);
          } else {
            token.permissions = ["*"]; // Owners have all permissions
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
        (session.user as any).staff_id = token.staff_id as string | null;
        (session.user as any).role = token.role as string;
        (session.user as any).permissions = token.permissions as string[];
        (session.user as any).company = token.company as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt" as const,
    // Keep users signed in for configured days
    maxAge: SESSION_MAX_AGE_SECONDS,
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
        maxAge: SESSION_MAX_AGE_SECONDS, // align with session.maxAge
      },
    },
  },
};

// v4 helper to get the current session server-side
export async function auth(): Promise<import("next-auth").Session | null> {
  return getServerSession(authOptions as any);
}
