# Dukaan Khata: Staff & Role Management Guide

Welcome to the **Role-Based Access Control (RBAC)** guide for Dukaan Khata. This document explains how you can control what your staff members can see and do within your shop in simple terms, followed by technical details for developers.

## 1. What is Role-Based Access Control (RBAC)?
RBAC is a simple way to manage your employees' permissions. Instead of giving everyone full access to your business data, you can create specific "Roles" (e.g., Cashier, Manager) and assign limited permissions to them.

- **Owner**: You (the shop creator). You automatically have full access to everything.
- **Staff**: Your employees. They can only see and do what you explicitly allow them to do.

*(Note: The currently logged-in user is hidden from the staff list to prevent accidental self-modifications and maintain a clean view of the employees).*

## 2. How Permissions Work
Instead of giving access to broad areas like "Sales" or "Purchases", permissions are very specific. For example, under "Sales", you can allow a staff member to **View Invoices** but restrict them from **Deleting Invoices**.

When you create a role, you will see a list of features (Modules) and specific actions (Permissions) you can check or uncheck.

## 3. The Full Flow: How to Add Staff

Here is the step-by-step flow of how to invite a staff member to your shop:

### Step 1: Create a Role
1. Go to **Settings > Staff Management** and open the **Roles** tab.
2. Click **Add Role**.
3. Name the role (e.g., "Junior Cashier").
4. Check the boxes for the exact permissions you want this role to have (e.g., Create Invoice, View Customers).
5. Save the role.

### Step 2: Invite Your Staff
1. Switch to the **Staff** tab in Staff Management.
2. Click **Invite Staff**.
3. Enter your staff member's Email address and select the Role you just created for them.
4. An invitation email will be sent securely to their inbox.

### Step 3: Staff Accepts the Invite
1. Your staff member opens their email and clicks the **Accept Invitation** link.
2. They will be taken to Dukaan Khata.
3. **If they are new:** They will be prompted to enter their Name and choose a Password to create their account and accept the invite simultaneously. After accepting, they will be redirected to the login page.
4. **If they already have an account:** They will see a "Login to Accept" button. Clicking this redirects them to the login screen. Once they successfully log in with the invited email, the system will automatically route them back, accept the invite, and redirect them straight to their dashboard.
5. Once logged in, they will *only* see the sections of the app that you allowed in their Role.

### Step 4: Removing a Staff Member
1. If you no longer want a staff member to access your shop, you can click **Delete** next to their name in the Staff tab.
2. **Safe Removal:** The system will permanently remove their access to *your* shop. They will immediately lose access to your shop data.
3. **Data Integrity:** Their core user account remains safely in the database. This ensures that if they also work at a different shop, their access to that other shop is not interrupted. It also means you can easily re-invite them in the future using the same email address without encountering any "already exists" errors.

---

## For Developers & IT Administrators (Technical Details)

If you are a developer deploying this system, here is how the backend operates.

### Database Architecture
We use specialized collections to maintain a flexible and scalable permission system:
- **`modules`**: The main navigation categories (e.g., `sales`, `reports`).
- **`permissions`**: Granular actions tied to modules (e.g., `sales.view_invoice`).
- **`roles`**: Custom user-created roles (e.g., "Cashier").
- **`role_permissions`**: Maps roles to permissions.
- **`user_roles`**: Maps a user to a role.

### Offline-First Functionality
Staff management logic utilizes local offline databases (via Dexie) and `SyncEngine` for a smooth offline-first experience:
- Fetched users are stored locally in the Dexie `users` table.
- Role assignments map into local `user_roles`.
- We utilize hooks like `useOfflineStaff` and `useOfflineRoles` which directly query the Dexie DB for real-time offline reactivity.

### Deployment & Setup
To deploy RBAC to a new environment (Staging/Production), the database must be seeded first.

**1. Set Environment Variables**
Ensure `.env.local` contains your DB string:
```env
MONGODB_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/dukaankhata"
```

**2. Run the Seeding Script**
Run this script to inject modules and permissions into the database. (Note: Modules with `isActive: false` are hidden).
```bash
npx tsx --env-file=.env.local scripts/seed-rbac.ts
```

### Code Implementation Highlights
- **Frontend (`usePermissions`)**: We use a React hook (`can('sales', 'view_invoice')`) to show or hide buttons and pages.
- **Backend API (`requirePermission`)**: API routes are securely locked down using `requirePermission('sales.create_invoice')` before any database action occurs.
- **Login Optimization**: When a staff member logs in, their permissions are flattened into a simple array (`['sales.view_invoice', ...]`) and stored in their session token. This makes permission checking lightning-fast without constant database queries.
- **Invitation Flow Resiliency**: Implements secure redirection loops leveraging `callbackUrl` with language/locale preservation (`/${locale}/login?callbackUrl=...`) and checks `sessionData` upfront.