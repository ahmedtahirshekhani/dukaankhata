# Role-Based Access Control (RBAC) Implementation Guide

This document summarizes the complete RBAC implementation, how permissions work, and the required steps to deploy this feature to Staging and Production environments.

## 1. Overview
The RBAC system introduces granular control over what a Staff member can view, edit, create, or delete across the application. 
- **Owner Role**: Full access automatically.
- **Staff Role**: Permissions are explicitly granted via the `Roles` management section.
- **Modules & Actions**: Instead of generic permissions for grouping pages (like Sales or Purchase), actions are bound directly to sub-modules (e.g., `view_invoice`, `create_quotations`).

### Database Schema & Collections
We use separate collections to provide maximum flexibility, scalability, and data normalization. Here is how they work together:

1. **`modules` Collection**: 
   - Acts as the source of truth for the primary navigation and feature areas (e.g., `sales`, `purchase`, `reports`).
   - By keeping this dynamic, we can introduce new features without hardcoding them in the UI.

2. **`permissions` Collection**: 
   - Stores every specific granular action tied to a module (e.g., `module_code: 'sales', action: 'view_invoice'`).
   - This allows the `Roles` UI to automatically render checkboxes for new permissions whenever they are seeded into the database, making the UI fully dynamic.

3. **`roles` Collection**: 
   - Stores custom user-defined roles (e.g., "Cashier", "Manager", "Admin").

4. **`role_permissions` Collection (Pivot/Mapping Table)**:
   - Maps a `role_id` to multiple `permission_id`s. 
   - Instead of storing long arrays in a single document, this relational mapping allows fast querying and avoids document size limits if permissions grow.

5. **`user_roles` Collection (Pivot/Mapping Table)**:
   - Maps a staff user's `user_id` to a `role_id`.
   - A user can theoretically have multiple roles, and this pivot collection keeps that architecture clean.

6. **`users` Collection**: 
   - When a staff member logs in, the backend quickly resolves their `user_roles` -> `roles` -> `role_permissions` -> `permissions` to build a flat list of strings (`['sales.view_invoice']`).
   - This flattened list is injected into their session/JWT token. This ensures that frontend checks and subsequent API calls are blazing fast (`user.permissions.includes('x')`) without running complex DB joins every time.

## 2. Deployment Steps (Staging / Production)

When deploying to a new environment, the modules and permissions must be seeded into the database before users can be assigned roles.

**Step 1: Set Environment Variables**
Ensure `.env.local` (or your production environment variables) contains the valid database connection string:
```env
MONGODB_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/dukaankhata"
```

**Step 2: Run the Seeding Script**
Run the `seed-rbac.ts` script to populate the `modules` and `permissions` collections in MongoDB. 
*Note: We have updated this script to ensure generic 'view/edit/delete/create' are NOT generated for grouping modules like Sales and Purchase.*

```bash
# Using tsx to run the TypeScript file
npx tsx scripts/seed-rbac.ts
```

*Expected Output:*
```
Starting RBAC seeding...
Seeding Modules...
Seeding Permissions...
RBAC seeding completed successfully.
```

**Step 3: Database Cleanup (If Upgrading Existing DB)**
If you are deploying this to a database that had an older version of RBAC, you must remove the obsolete generic permissions from `sales` and `purchase` directly from the `permissions` collection. You can do this by running a quick Mongo script or manually deleting documents where `module_code` is `sales` or `purchase` AND `action` is `view`, `create`, `edit`, or `delete`.

## 3. How the Code Works

### Frontend / UI (React)
We use a custom hook `usePermissions()` (`src/hooks/use-permissions.ts`) to manage frontend visibility.
- **`hasModuleAccess(module)`**: Checks if the user has **any** permission starting with `module.`. Used to show/hide the main Sidebar sections (like Sales or Purchase).
- **`can(module, action)`**: Checks for a specific granular permission. Example: `can('sales', 'view_invoice')`. Used to show/hide specific sub-links or buttons (Edit/Delete).

**Protected Pages & Redirects**
- **Sidebar (`admin-layout.tsx`)**: The Sales, Purchase, and Reports dropdowns will only render if the user has at least one sub-permission in those categories. If a dropdown has no accessible items, the collapse/chevron icon is hidden entirely.
- **Module Parent Pages (`admin/sales/page.tsx`, etc.)**: If a user navigates to the `/sales` page via direct link but has no sales-related permissions, the `useEffect` hook redirects them to the main Dashboard (`/admin`). The cards on these pages are also filtered based on permissions.
- **Roles Tab (`roles-tab.tsx`)**: The UI dynamically renders checkboxes for every sub-action belonging to a module.

### Backend / API Routes
API Routes are protected using `requirePermission(permission)` from `src/lib/auth/rbac.ts`.

Example:
```typescript
import { requirePermission } from "@/lib/auth/rbac";

export async function POST(req: Request) {
  // Enforce create permission for invoices
  const auth = await requirePermission('sales.create_invoice');
  if (!auth.allowed) return auth.response;
  
  // Proceed with DB creation...
}
```

## 4. Summary of Recent Fixes
- Standardized UI for Staff Management (`staff-tab.tsx` and `roles-tab.tsx`) to match the `PaymentInPage` (tables, search bars, pagination).
- Removed generic CRUD actions (`view, edit, create, delete`) from `Sales` and `Purchase` modules in `seed-rbac.ts` as they are just folders/groupings.
- Applied multi-lingual (i18n) translation support using `next-intl` to the staff and role tables.
- Ensured UI elements gracefully fallback or disappear if RBAC prevents action, ensuring a smooth User Experience.
- Added `isActive` flag to modules and permissions during seeding. Any module or permission with `isActive: false` (like AI Chat) is automatically filtered out from APIs and Offline Sync, hiding it from the Roles assignment UI.

## 5. Professional Staff Invitation Workflow (Upcoming)
Instead of Admins creating passwords manually, Staff are added via an Email Invite system:
1. Admin enters an Email and Role.
2. System emails a secure token link via Nodemailer.
3. User clicks the link. If they already have an account, the shop is instantly linked. If they are new, they just provide their Name and set a new Password to register and join the shop simultaneously.

---
**Run the Seeding Script with Environment Variables (Crucial for DB Connection):**
```bash
npx tsx --env-file=.env.local scripts/seed-rbac.ts
```