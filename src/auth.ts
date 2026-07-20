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

          // We just return the pure user data.
          // The JWT callback will figure out the workspaces and roles.
          return {
            id: userData._id.toString(),
            email: userData.email,
            name: userData.name,
            company: userData.company_name,
            legacy_role: userData.role,
            legacy_owner_id: userData.owner_id ? userData.owner_id.toString() : null
          };
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
    async jwt({ token, user, trigger, session }: any) {
      if (trigger === "update" && session?.active_workspace_id) {
        token.active_workspace_id = session.active_workspace_id;
      }

      // On login, seed initial data from user
      if (user) {
        token.real_user_id = user.id;
        token.email = user.email;
        token.name = user.name;
        // Backward compatibility: if they were created as a legacy staff, default to that shop
        if (user.legacy_role === "staff" && user.legacy_owner_id) {
          token.active_workspace_id = user.legacy_owner_id;
        } else {
          token.active_workspace_id = user.id; // Default to their own shop
        }
      }

      if (token?.real_user_id) {
        try {
          const usersCollection = await getCollection(COLLECTIONS.USERS);
          const dbUser = await usersCollection.findOne({ _id: toObjectId(token.real_user_id as string) });
          
          if (dbUser) {
            token.name = dbUser.name;
            token.email = dbUser.email;
            
            // 1. Discover all workspaces
            const workspaces = [];
            
            // Add their own shop (if they are not a legacy pure-staff without their own shop access, but we'll just add it anyway)
            workspaces.push({
              id: dbUser._id.toString(),
              type: "owner",
              name: dbUser.company_name || `${dbUser.name}'s Shop`
            });

            // Find all shops where they are staff
            const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
            const rolesColl = await getCollection(COLLECTIONS.ROLES);
            
            const userRoles = await userRolesColl.find({ user_id: toObjectId(token.real_user_id as string) }).toArray();
            if (userRoles.length > 0) {
              const roleIds = userRoles.map(ur => ur.role_id);
              const roles = await rolesColl.find({ _id: { $in: roleIds } }).toArray();
              
              // Get unique owner IDs from those roles
              const ownerIds = Array.from(new Set(roles.map(r => r.owner_id.toString())));
              
              for (const oId of ownerIds) {
                // Avoid duplicating their own shop if they somehow have a role in it
                if (oId === dbUser._id.toString()) continue;
                
                const ownerUser = await usersCollection.findOne({ _id: toObjectId(oId) });
                if (ownerUser) {
                  workspaces.push({
                    id: oId,
                    type: "staff",
                    name: ownerUser.company_name || `${ownerUser.name}'s Shop`
                  });
                }
              }
            }
            
            token.workspaces = workspaces;

            // Make sure active_workspace_id is valid
            if (!workspaces.find(w => w.id === token.active_workspace_id)) {
               token.active_workspace_id = workspaces[0].id;
            }

            const activeWorkspace = workspaces.find(w => w.id === token.active_workspace_id);
            token.role = activeWorkspace?.type || "owner";
            token.company = activeWorkspace?.name || "";
            
            // Mask the token.id to act as the shop owner's ID for all backend API routes!
            token.id = token.active_workspace_id;
            token.staff_id = token.role === "staff" ? token.real_user_id : null;

            // Load permissions for the active workspace
            if (token.role === "staff") {
              // Find the role(s) the user has in THIS specific workspace
              const workspaceRoles = await rolesColl.find({ owner_id: toObjectId(token.active_workspace_id as string) }).toArray();
              const workspaceRoleIds = workspaceRoles.map(r => r._id.toString());
              
              // Filter userRoles to only those in this workspace
              const myRolesInWorkspace = userRoles.filter(ur => workspaceRoleIds.includes(ur.role_id.toString()));
              
              if (myRolesInWorkspace.length > 0) {
                const rolePermsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
                const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);
                
                const rIds = myRolesInWorkspace.map(ur => ur.role_id);
                const rolePerms = await rolePermsColl.find({ role_id: { $in: rIds } }).toArray();
                const permissionIds = rolePerms.map(rp => rp.permission_id);
                
                const perms = await permsColl.find({ _id: { $in: permissionIds } }).toArray();
                token.permissions = perms.map(p => `${p.module_code}.${p.action}`);
              } else {
                token.permissions = [];
              }
            } else {
              token.permissions = ["*"]; // Owners have all permissions
            }
          }
        } catch (err) {
          console.error("jwt callback user fetch error", err);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        // Backend overrides:
        (session.user as any).id = token.id as string; // This is the SHOP ID
        (session.user as any).staff_id = token.staff_id as string | null; // This is the REAL USER ID if staff
        (session.user as any).role = token.role as string;
        (session.user as any).permissions = token.permissions as string[];
        (session.user as any).company = token.company as string;
        
        // Multi-tenancy specific additions:
        (session.user as any).real_user_id = token.real_user_id as string;
        (session.user as any).active_workspace_id = token.active_workspace_id as string;
        (session.user as any).workspaces = token.workspaces as any[];
        
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
