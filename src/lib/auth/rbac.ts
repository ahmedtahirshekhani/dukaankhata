import { auth } from "@/auth";
import { NextResponse } from "next/server";

interface AuthResponse {
  allowed: boolean;
  response?: NextResponse;
  user?: any;
}

/**
 * Checks if the current user has the required permission.
 * Owners have implicit access to everything.
 * Staff members must have the specific permission in their JWT token.
 * 
 * @param permission e.g., "sales.create", "inventory.view"
 */
export async function requirePermission(permission: string): Promise<AuthResponse> {
  const session = await auth();

  if (!session?.user) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user as any;

  // Owners can do anything
  if (user.role === "owner" || !user.role) {
    return { allowed: true, user };
  }

  // Staff members need specific permissions
  const permissions = user.permissions || [];
  
  // '*' grants full access
  if (permissions.includes('*')) {
    return { allowed: true, user };
  }

  if (!permissions.includes(permission)) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Forbidden", message: `Missing required permission: ${permission}` },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, user };
}

/**
 * A simpler checker that returns a boolean for non-API contexts
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const user = session.user as any;
  if (user.role === "owner" || !user.role) return true;

  const permissions = user.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}
