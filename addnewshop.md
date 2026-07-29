# Multi-Shop (Workspaces) Architecture & Implementation Guide

Yeh document **Production Developers** aur DevOps team ke liye tayar kiya gaya hai ta ke wo samajh sakein ke Dukan Khata mein **"Add New Shop"** (Multi-Workspace) ka feature kaisay implement kiya gaya hai aur ise Production par baghair kisi data loss ke kaisay deploy karna ہے۔

---

## 🏗️ 1. Architecture Overview (Pehlay vs Ab)

### ❌ Legacy System (One User = One Shop)
Pehlay system is assumption par chalta tha ke aik user account ki sirf aik hi dukan (company) ho sakti hai. 
- **Identify:** `users` collection mein `company_name` hota tha.
- **Data Scoping:** Tamam collections (`products`, `customers`, `orders`) mein data ko user ke `_id` (as `owner_id`) se filter kiya jata tha.

### ✅ New System (Multi-Workspace / Shops)
Ab aik user unlimited shops bana sakta hai aur un sab ko aik hi account se manage kar sakta hai.
- **Identify:** Aik nayi collection `shops` introduce ki gayi hai. Har shop ka apna alag `_id` hai.
- **Data Scoping:** Tamam collections mein jo `owner_id` use ho raha hai, wo ab haqeeqat mein **Shop ka `_id` (Workspace ID)** hai!

---

## 🧠 2. The "Masking" Masterstroke (Zero API Refactoring)

Sab se bara challenge yeh tha ke agar hum `owner_id` ka matlab User ID se badal kar Shop ID kar dein, to humein 100+ backend API routes change karne parte (kyun ke sab APIs `user.id` use kar rahi theen). Is se bachne ke liye `auth.ts` mein aik masterstroke use kiya gaya hai:

```typescript
// File: src/auth.ts (JWT Callback)
// Mask the token.id to act as the shop owner's ID for all backend API routes!
token.id = token.active_workspace_id; 

// File: src/auth.ts (Session Callback)
(session.user as any).id = token.id as string; 
```
**Impact:** Jab bhi backend ki koi API `const user = await getCurrentUser()` call karti hai, to `user.id` usay real user ka ID nahi, balke **Active Shop ka ID** deta hai. 
Is wajah se humein Products, Customers, Orders ki APIs mein aik line ka bhi code change nahi karna para aur data perfectly Shop level par isolate ho gaya!

---

## 🔄 3. Key Flow Changes

### A. Signup Flow (`/api/auth/signup`)
Jab naya user register hota hai, system `users` mein record bananay ke baad automatically uski primary shop `shops` collection mein bana deta hai. **(Note: Pehli shop ka `_id` bilkul user ke `_id` jesa hi rakha jata hai ta ke legacy architecture map ho sakay).**

### B. Invite & Staff Flow (`/api/staff/invite/accept`)
Staff ab kisi specific User ke under invite nahi hota, balke directly **Shop (Workspace)** ke under invite hota hai. `user_roles` mein `role` ka jo owner_id hota hai, wo ab Shop ka ID hai. 

### C. Add New Shop (Frontend)
`WorkspaceSwitcher` component mein "+ Add New Shop" ka modal shamil kiya gaya hai jo `/api/shops/create` par request bhejta hai. Yeh naya shop document banata hai aur session update kar deta hai.

---

## 🚀 4. Production Deployment & Migration Steps

Jab ye code Production par deploy hoga, to existing purane users (jin ki `shops` collection mein entry nahi hai) un ka data kaisay bache ga? Is ke liye Migration Script banai gayi hai.

### Migration Logic:
Script `users` collection se un sab users ko uthati hai jin ke paas `company_name` hai, aur un ke liye `shops` collection mein document banati hai. 
**Crucial Point:** Nayi shop ka `_id` strictly us user ke `_id` par force kiya gaya hai. Is wajah se purani tamam products aur customers (jo user id par mapped thay) automatic is nayi shop ke under aa jate hain!

### Execution Command (Run once during deployment):
```bash
npx tsx scripts/migrate-shops.ts
```

> **Note for Devs:** `auth.ts` mein "On-the-fly" migration bhi mojood hai. Agar migration script run karna bhool bhi jayen, to jab bhi purana user login karega, system khud uski shop background mein bana dega!

---

## ❓ 5. Developer FAQs

**Q: Kya staff agar product add kare to wo us staff ki profile mein save ho jayega?**
**Ans:** NAHI! Jaisa ke upar point 2 mein bataya gaya hai, backend par `user.id` mask ho kar **Shop ID** ban chuka hai. Staff jab bhi add karega, data automatically selected Company/Shop ke ID par save hoga.

**Q: Kya "Add New Shop" banane se database ki purani collections break hongi?**
**Ans:** Bilkul nahi. Existing collections (products, orders) ko farq nahi parta ke `owner_id` kahan se aa raha hai. Nayi shop create hone par MongoDB naya ObjectID dega, jo perfect chalega.

**Q: Kya purane Invite links kaam karna chor denge?**
**Ans:** Nahi. `api/staff/invite/accept` route mein Fallback logic laga di gayi hai. Agar use `shop` nahi milti to wo `users` collection se company_name utha leta hai ta ke purane invites gracefully accept ho jayen.

**Q: Nayi shop banne par Default Accounts (Cash/Expense) kaisay banenge?**
**Ans:** `/api/shops/create` API route ke andar already `Walk In Customer` ka auto-generation code dal diya gaya hai. Is mein `user_id` explicitly `result.insertedId` (Nayi Shop ki ID) set ki gayi hai ta ke backend APIs jo mask `user.id` use karti hain, unhein correct data milay. Us ke sath hi default configurations (AI Chat waghera) bhi nayi shop ke sath link kar di jati hain.

**Q: Kya "Add New Shop" banane wali shop ka Owner current active shop hogi ya wo User khud?**
**Ans:** Nayi dukan hamesha bananay walay **Real User** (`user.real_user_id`) ke naam par save hoti hai, chahay wo user us waqt kisi aur shop mein staff hi kyun na ho. Agar hum mask wala `user.id` use karte, to nayi dukan ghalati se us company ki ban jati jis mein user as a staff kaam kar raha tha! Is bachne ke liye create route mein `owner_user_id: toObjectId((user as any).real_user_id || user.id)` lagaya gaya hai.

**Q: Offline Database (IndexedDB) mein Workspaces ka data kaisay manage ho raha hai aur mix hone se kaisay bachaya gaya hai?**
**Ans:** Har Workspace (Shop) ka apna aik alag IndexedDB database hota hai jis ka naam dynamic hota hai (e.g. `dukaankhata_{WorkspaceID}`). Jab user workspace switch karta hai, to `admin-layout.tsx` na sirf reload karta hai balke `localStorage.removeItem("last_sync_timestamp")` chala kar purani shop ka sync time delete kar deta hai. Is se `SyncEngine` foran server se nayi shop ka **Full Data** laa kar naye khali database mein daal deta hai, aur offline syncing flawlessly kaam karti hai!