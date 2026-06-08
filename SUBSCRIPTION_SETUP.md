# 📱 DukaanKhata Subscription System Setup Guide

## Overview

This guide explains the complete subscription system for DukaanKhata, including trial management, plan pricing, renewal automation, and cron job setup.

---

## 🔧 Environment Variables Setup

Add these variables to your `.env.local` file:

```env
# Trial Period Configuration
TRIAL_NUMBER_OF_DAYS=12

# Subscription Plan Pricing (in PKR)
PLAN_PRICE=1000

# Cron Job Security Token
CRON_SECRET_TOKEN=super-secret-cron-token-change-this-in-production
```

### Variable Descriptions:

| Variable | Description | Example | Type |
|----------|-------------|---------|------|
| `TRIAL_NUMBER_OF_DAYS` | Number of free trial days | 12 | Integer |
| `PLAN_PRICE` | Starter plan monthly price | 1000 | Integer (PKR) |
| `CRON_SECRET_TOKEN` | Security token for cron endpoint | Very Long Random String | String |

---

## 💳 Subscription Plans

### Trial Plan
- **Duration:** Configured in `TRIAL_NUMBER_OF_DAYS` (default: 12 days)
- **Price:** Free (PKR 0)
- **Max Items:** 50
- **Max Parties:** 10
- **Max Users:** 1
- **Features:** Basic reports, Basic analytics

### Starter Plan (Only Available Plan)
- **Duration:** 30 days (recurring)
- **Price:** `PLAN_PRICE` (default: PKR 1000/month)
- **Max Items:** Unlimited (999999)
- **Max Parties:** Unlimited (999999)
- **Max Users:** Unlimited (999999)
- **Features:** All features including basic reports, advanced analytics, customer ledger, P&L reports, email invoices, API access

---

## 🔄 Subscription Lifecycle

### 1. **Signup (User Registration)**
When a user signs up:
- ✅ User account created
- ✅ Default party "Walk In Customer" created
- ✅ Trial subscription automatically created
  - **Status:** `active`
  - **Plan:** `trial`
  - **Expiry:** today + `TRIAL_NUMBER_OF_DAYS`
  - **Amount:** 0 (free)

**Code Location:** `src/app/[locale]/api/auth/signup/route.ts`

```typescript
// Trial subscription is created automatically on signup
const trialDays = parseInt(process.env.TRIAL_NUMBER_OF_DAYS || "14", 10);
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + trialDays);

await subscriptionsCollection.insertOne({
  user_id: newUser?._id,
  email: email,
  plan: "trial",
  status: "active", // Trial is active by default
  amount: 0,
  expiry_date: expiryDate,
  // ... other fields
});
```

### 2. **Daily Cron Job (Subscription Expiration Handling)**

**When:** Every day at **12:00 PM Pakistan Time (UTC+5)** = 7:00 AM UTC

**What Happens:**
1. Find all subscriptions where `expiry_date <= now` and `status = "active"` or `"trial"`
2. Mark them as `"expired"`
3. Check if user already has a `"pending"` subscription
   - If YES → Skip (prevents duplicate pending)
   - If NO → Create new 30-day `"pending"` subscription
4. All paid subscriptions use **Starter** plan (only one plan available)
5. Set amount from `PLAN_PRICE` environment variable

**Code Location:** `src/app/api/cron/subscriptions/route.ts`

**Example Flow:**

```
DAY 12 (Cron Job Runs):
  Trial subscription expires
  ├─ Status: active → expired ✓
  └─ Create new pending subscription
     ├─ Plan: starter (upgraded from trial)
     ├─ Amount: PLAN_PRICE (from .env)
     ├─ Status: pending (awaiting payment)
     └─ Expiry: 30 days from now

USER STATE: "Pending" (waiting for payment)

ADMIN ACTIVATES (After receiving payment):
  Pending subscription → active ✓
  └─ Billing cycle: 30 days

DAY 42 (Cron Job Runs Again):
  Active subscription expires
  ├─ Status: active → expired ✓
  ├─ Check: Does "pending" already exist?
  │  └─ NO → Create new pending ✓
  └─ New pending subscription created
     ├─ Plan: starter (always starter)
     ├─ Amount: PLAN_PRICE
     └─ Status: pending
```

---

## 🌐 Setting Up Cron Job

### Option 1: Using cron-job.org (Recommended)

1. **Visit:** https://cron-job.org/

2. **Login/Signup** with email

3. **Create New Cron Job:**
   - **Execution Timezone:** `Asia/Karachi` (Pakistan)
   - **Title:** `DukaanKhata Subscription Renewal`
   - **URL:** `https://yourdomain.com/api/cron/subscriptions`
   - **Cron Expression:** `0 7 * * *`
     - Meaning: Every day at 7:00 AM UTC (= 12:00 PM Pakistan)
   - **HTTP Method:** GET

4. **Add Header:**
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer super-secret-cron-token-change-this-in-production`

5. **Save** and enable the cron job

### Option 2: Manual Testing (POST)

Test the cron job manually before setting up automation:

```bash
curl -X POST https://yourdomain.com/api/cron/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer super-secret-cron-token-change-this-in-production" \
  -d '{
    "token": "super-secret-cron-token-change-this-in-production"
  }'
```

**Expected Response:**
```json
{
  "message": "Manual cron job test completed",
  "processedSubscriptions": 5,
  "newSubscriptionsCreated": 3,
  "timestamp": "2026-06-02T07:00:00.000Z"
}
```

### Option 3: Using Node.js Cron (Advanced)

For on-server cron, add a background job using `node-cron`:

```bash
npm install node-cron
```

Create `src/lib/cron/subscription-renewal.ts`:

```typescript
import cron from 'node-cron';
import { getCollection, COLLECTIONS } from '@/lib/db/mongodb';

export function startSubscriptionCronJob() {
  // Runs daily at 12 PM Pakistan time (7 AM UTC)
  cron.schedule('0 7 * * *', async () => {
    console.log('Running subscription renewal cron...');
    
    const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
    const now = new Date();
    
    // Process expired subscriptions...
    // Same logic as /api/cron/subscriptions/route.ts
  });
}
```

Then call in your Next.js initialization:
```typescript
// src/app/layout.tsx or middleware
import { startSubscriptionCronJob } from '@/lib/cron/subscription-renewal';

// Call once on app start
startSubscriptionCronJob();
```

---

## 📊 MongoDB Schema

### Subscriptions Collection

```javascript
db.subscriptions.insertOne({
  _id: ObjectId(),
  user_id: ObjectId(),           // Reference to user
  email: "user@example.com",
  plan: "starter",               // "trial" | "starter" (only 2 plans)
  status: "active",              // "active" | "pending" | "expired" | "cancelled"
  amount: 1000,                  // Price in PKR
  trial_days: 12,                // Only for trial subscriptions
  created_at: ISODate(),
  updated_at: ISODate(),
  expiry_date: ISODate(),        // When subscription expires
  activated_date: ISODate(),     // When activated (admin sets)
  billing_cycle_start: ISODate(),
  billing_cycle_end: ISODate(),
  next_billing_date: ISODate(),
  previous_subscription_id: ObjectId(),  // Track renewal chain
  is_renewal: Boolean            // true = renewal, false/undefined = first-time
})
```

### Indexes

```javascript
db.subscriptions.createIndex({ user_id: 1 });
db.subscriptions.createIndex({ email: 1 });
db.subscriptions.createIndex({ status: 1 });
db.subscriptions.createIndex({ expiry_date: 1 });
db.subscriptions.createIndex({ created_at: -1 });
```

---

## 💻 API Endpoints

### Get User Subscription Status

**Endpoint:** `GET /api/subscriptions/status`

**Response:**
```json
{
  "isActive": true,
  "isPending": false,
  "isExpired": false,
  "plan": "starter",
  "daysRemaining": 28,
  "expiryDate": "2026-07-02T12:00:00Z",
  "status": "active"
}
```

### Get Pending Subscriptions (Admin)

**Endpoint:** `GET /api/subscriptions/pending`

**Response:**
```json
[
  {
    "_id": "...",
    "email": "user@example.com",
    "plan": "starter",
    "amount": 1000,
    "status": "pending",
    "created_at": "2026-06-02T12:00:00Z"
  }
]
```

### Activate Subscription (Admin)

**Endpoint:** `POST /api/subscriptions/[id]/activate`

**Body:**
```json
{
  "subscriptionId": "..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription activated",
  "subscription": { ... }
}
```

---

## 🔒 Security

### Protecting the Cron Endpoint

The cron endpoint uses Bearer token authentication:

```typescript
const authHeader = request.headers.get("authorization");
const expectedToken = process.env.CRON_SECRET_TOKEN;

if (authHeader !== `Bearer ${expectedToken}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Best Practices:**
1. ✅ Set `CRON_SECRET_TOKEN` to a long random string
2. ✅ Change it in production (don't use default)
3. ✅ Use HTTPS only for cron calls
4. ✅ Restrict cron-job.org IP whitelist if possible
5. ✅ Monitor cron job execution logs

---

## 📝 Manual Database Management

### Check User's Subscription

```javascript
// MongoDB Compass or mongosh
db.subscriptions
  .find({ email: "user@example.com" })
  .sort({ created_at: -1 })
  .limit(1)
```

### Update Subscription Status (Admin)

```javascript
// Mark as active after payment received
db.subscriptions.updateOne(
  { _id: ObjectId("...") },
  {
    $set: {
      status: "active",
      activated_date: new Date(),
      billing_cycle_start: new Date(),
      billing_cycle_end: new Date(Date.now() + 30*24*60*60*1000),
      next_billing_date: new Date(Date.now() + 30*24*60*60*1000)
    }
  }
)
```

### Cancel Subscription

```javascript
db.subscriptions.updateOne(
  { _id: ObjectId("...") },
  {
    $set: {
      status: "cancelled",
      cancelled_date: new Date()
    }
  }
)
```

### Extend Trial (Special Case)

```javascript
// Extend trial by 7 more days
db.subscriptions.updateOne(
  { _id: ObjectId("..."), plan: "trial" },
  {
    $set: {
      expiry_date: new Date(Date.now() + 19*24*60*60*1000) // 12 + 7 days
    }
  }
)
```

---

## 🧪 Testing

### Test Trial Expiration

1. Manually update a trial subscription to expire today:
   ```javascript
   db.subscriptions.updateOne(
     { plan: "trial" },
     { $set: { expiry_date: new Date() } }
   )
   ```

2. Call cron endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/cron/subscriptions \
     -H "Content-Type: application/json" \
     -d '{ "token": "super-secret-cron-token-change-this-in-production" }'
   ```

3. Check results:
   - Trial should be marked `"expired"`
   - New pending subscription should be created

### Check Subscription Helpers

**File:** `src/lib/db/subscription.ts`

Available functions:
- `getUserActiveSubscription(userId)` - Get current active subscription
- `getUserLatestSubscription(userId)` - Get latest subscription (any status)
- `hasActiveSubscription(userId)` - Boolean check
- `getSubscriptionStatus(userId)` - Full status details
- `getPendingSubscriptions()` - All pending subscriptions
- `activateSubscription(subscriptionId)` - Admin activate
- `getPlanLimits(plan)` - Get plan features and pricing
- `canUserPerformAction(userId, action)` - Check if allowed

---

## 🐛 Troubleshooting

### Cron job not running

**Check:**
1. Verify `CRON_SECRET_TOKEN` matches in `.env.local` and cron-job.org
2. Confirm URL is correct: `https://yourdomain.com/api/cron/subscriptions`
3. Check server logs: `npm run dev` output
4. Test manually: `curl -X POST ...`

### Subscriptions not expiring

**Check:**
1. Verify cron job is enabled at cron-job.org
2. Check timezone: Set to `Asia/Karachi` for 12 PM Pakistan time
3. Test with manual date: Set `expiry_date` to past date, run cron
4. Check MongoDB connection in production

### Duplicate pending subscriptions

**Cause:** Cron ran twice before checking for existing pending

**Fix:**
```javascript
// Clean up duplicates
db.subscriptions.deleteMany({
  user_id: ObjectId("..."),
  status: "pending",
  created_at: { $lt: new Date(Date.now() - 1000*60*60*24) } // older than 1 day
})
```

### Amount showing incorrectly

**Check:**
1. Verify environment variables set correctly
2. Check if `PLAN_PRICE` is in `.env.local`
3. Verify value is a number: `1000` not `"1000"`
4. Restart Next.js after `.env` changes: `npm run dev`

---

## 📞 Support

For issues or questions:
- Check logs in server console
- Monitor MongoDB collections manually
- Test cron manually with curl
- Review code in `src/lib/db/subscription.ts`

---

**Last Updated:** June 2, 2026
**System Version:** v1.0
