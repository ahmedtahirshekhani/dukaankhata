import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session } = useSession();
  
  const can = (module: string, action: string) => {
    if (!session?.user) return false;
    
    const user = session.user as any;
    
    // Owners have full access to everything
    if (user.role === "owner" || !user.role) {
      return true;
    }

    // Check staff permissions
    const permissions = user.permissions || [];
    
    // Wildcard permission grants all access
    if (permissions.includes('*')) {
      return true;
    }
    
    const requiredPermission = `${module}.${action}`;
    return permissions.includes(requiredPermission);
  };

  const hasModuleAccess = (module: string) => {
    if (!session?.user) return false;
    
    const user = session.user as any;
    if (user.role === "owner" || !user.role) return true;

    const permissions = user.permissions || [];
    if (permissions.includes('*')) return true;

    // Check if the user has any permission starting with the module code
    return permissions.some((p: string) => p.startsWith(`${module}.`));
  };

  return { can, hasModuleAccess };
}
