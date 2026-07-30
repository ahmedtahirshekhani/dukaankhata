import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

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
 * Checks if the user has ANY of the required permissions.
 */
export async function requireAnyPermission(permissionsList: string[]): Promise<AuthResponse> {
  const session = await auth();

  if (!session?.user) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = session.user as any;

  if (user.role === "owner" || !user.role) {
    return { allowed: true, user };
  }

  const permissions = user.permissions || [];
  
  if (permissions.includes('*')) {
    return { allowed: true, user };
  }

  const hasAny = permissionsList.some(p => permissions.includes(p));
  if (!hasAny) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Forbidden", message: `Missing at least one of the required permissions: ${permissionsList.join(', ')}` },
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

/**
 * Checks if the user has any permission for a given module.
 */
export async function hasModuleAccess(module: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const user = session.user as any;
  if (user.role === "owner" || !user.role) return true;

  const permissions = user.permissions || [];
  if (permissions.includes('*')) return true;

  return permissions.some((p: string) => p.startsWith(`${module}.`));
}

/**
 * Ensures a user has a specific permission in a Server Component.
 * Redirects to the specified URL (default /admin) if they don't.
 */
export async function requireServerPermission(permission: string, locale: string = 'en', redirectTo: string = '/admin') {
  const hasAccess = await hasPermission(permission);
  if (!hasAccess) {
    redirect(`/${locale}${redirectTo}`);
  }
}

/**
 * Ensures a user has access to a specific module in a Server Component.
 * Redirects to the specified URL (default /admin) if they don't.
 */
export async function requireServerModuleAccess(module: string, locale: string = 'en', redirectTo: string = '/admin') {
  const hasAccess = await hasModuleAccess(module);
  if (!hasAccess) {
    redirect(`/${locale}${redirectTo}`);
  }
}
