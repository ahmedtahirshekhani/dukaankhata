# Implementation Plan: Multi-Tenancy Workspace Switching

## Goal Description
Currently, a user can only be an owner of one shop OR staff at one shop. The email must be unique, meaning the same email cannot manage multiple shops. The goal is to allow a single user account (email) to manage multiple shops. 
When logged in, they will have a dropdown in the sidebar to switch between "Workspaces" (shops they own or are staff at). Switching the workspace will update their context, showing data and permissions for the selected shop.

## Proposed Architecture
Since the entire application heavily relies on `owner_id` (which is often derived from `session.user.id`), we need to introduce a concept of an `active_workspace` without breaking hundreds of API endpoints.

### 1. Database Schema Changes
Currently, `/api/staff` creates a *new user document* and links it to an `owner_id`.
We will modify `/api/staff` to:
- If the email already exists, DO NOT fail. Instead, just insert a new role mapping in `user_roles` for that existing user.
- The `roles` collection already has an `owner_id`. Thus, the `user_roles` mapping effectively links the user to a new shop.

### 2. Session & Authentication Updates (`src/auth.ts`)
- During login (`jwt` callback), we will discover **all** shops the user has access to:
  1. Their own shop (where they are the owner, `shop_id = user._id`).
  2. Any shops they are staff at (by finding all `user_roles`, getting the corresponding `roles`, and extracting unique `owner_id`s).
- We will store an `active_workspace_id` in the JWT token. By default, this will be their own shop, or the first shop they are staff at.
- The `session` callback will expose `session.user.active_workspace_id` and `session.user.workspaces` (list of available shops for the dropdown).

### 3. Workspace Switching Mechanism
- We will create a new API route `/api/auth/switch-workspace` (or use NextAuth `update()` function) to change the `active_workspace_id` in the token.
- In `src/components/layout/admin-layout.tsx`, we will add a Dropdown above the navigation menu showing all available workspaces. Clicking one will update the session and reload the page.

### 4. API Endpoints Compatibility
- All backend routes currently do `const ownerId = user.id`.
- We will modify `getCurrentUser()` in `src/lib/auth/utils.ts` so that `user.id` automatically returns `user.active_workspace_id`.
- **CRITICAL BENEFIT**: By overriding `user.id` to be the `active_workspace_id`, we do NOT have to rewrite all 100+ API routes in the app! They will seamlessly query data for the currently selected shop.

## User Review Required

> [!WARNING]
> This architecture means `user.id` in the backend will represent the **Shop ID** (Owner's ID) rather than the physical logged-in person's ID. This is how the system currently works for staff, but we are extending it dynamically. Is this acceptable?

## Open Questions

> [!IMPORTANT]
> 1. When a user switches shops, should they be redirected to the main Dashboard (`/admin`), or should they stay on the current page (e.g. Configuration)? (Redirecting to Dashboard is safer because they might not have permissions for the current page in the new shop).
> 2. How should the shops be named in the dropdown? Should we use the Owner's `company_name`? If an owner hasn't set a company name, what should be the fallback? "Personal Shop"?
> 3. Does the `users` collection currently use `email` as a unique index in MongoDB? If so, we don't need to change the DB index, because we will just link the existing user document instead of creating a new one.

## Verification Plan
### Automated Tests
- Test `/api/staff` to add an existing email as staff and verify it doesn't duplicate the user.
- Test `auth.ts` to ensure it loads multiple workspaces into the token.

### Manual Verification
- Log in as a user who is an owner of Shop A and staff at Shop B.
- Verify the dropdown appears in the sidebar.
- Switch to Shop B, verify data (e.g., configurations, products) changes to Shop B's data.
- Verify permissions update correctly for Shop B.



1. Simple Staff (Naya User)
Yeh woh staff hai jis ki email DukaanKhata par pehle se mojood nahi hoti (bilkul naya account).

Data Kis Tarah Add Hota Hai?

Backend sab se pehle users collection mein aik naya record (document) banata hai. Is mein us bande ka Naam, Email, aur aap ne jo Password dala hota hai (encrypt kar ke) save hota hai.
Is naye user ki us mein ek owner_id bhi aap ki shop ki lag jati hai.
Us ke baad, system user_roles collection mein aik entry banata hai jo is naye user ki _id ko aap ki shop ke Role ke sath link kar deti hai.
2. Workspace Wala Staff (Existing User)
Yeh woh staff hai jis ki email DukaanKhata par pehle se mojood hai (maslan woh kisi aur shop ka owner hai ya kisi aur shop par staff hai).

Data Kis Tarah Add Hota Hai?

Jab aap is ki email daalte hain tou backend check karta hai ke "Yeh email tou pehle se mojood hai".
Backend users collection mein koi naya account nahi banata aur na hi us ka password change karta hai. Woh sirf us existing user ki purani _id utha leta hai.
Phir system seedha user_roles collection mein jata hai aur uski purani _id ko aap ki shop ke Role ke sath link kar deta hai.
Khulasa (Summary)
Naya Staff: users mein aik naya account banta hai + user_roles mein link hota hai.
Workspace Staff: users mein kuch naya nahi banta, sirf user_roles mein aap ki shop ke sath naya link ban jata hai.