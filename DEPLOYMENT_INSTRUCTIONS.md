# Production Deployment - Subscription & Cron Job System

## 📋 Kya Implement Kiya Gaya Hai?

### Core Features:
✅ **Trial Subscription System** - Naye users ko 12 din free trial
✅ **Automatic Renewal** - Daily cron job expiry check aur pending subscription creation
✅ **Single Plan Architecture** - Ek hi "Starter" plan (30 din paid)
✅ **Real-time Status Display** - Admin header mein subscription badge
✅ **Duplicate Prevention** - Ek user ko multiple pending subscriptions nahi

---

## 🔧 Environment Variables Setup

**Production mein ye variables set karne hain:**

```env
# Trial period (days)
TRIAL_NUMBER_OF_DAYS=12

# Starter plan price (PKR)
PLAN_PRICE=1000

# CRON JOB SECRET TOKEN - SECURITY KE LIYE ZAROORI HAI
# Production mein ek STRONG aur RANDOM token dalna (MUST CHANGE!)
CRON_SECRET_TOKEN=change-this-to-a-strong-random-secret-token-in-production
```

**Token Generate Kaise Karein:**
```powershell
# PowerShell mein
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$(New-Guid)")) 
```

**Example Strong Token:**
```
c3VwZXItc2VjdXJlLXRva2VuLWxvbmctYW5kLWNvbXBsZXgtYW5kLXJhbmRvbS0yMDI2LXByb2R1Y3Rpb24=
```

---

## 📅 Cron-job.org Setup Instructions

### Step 1: Login/Register
- Website: https://cron-job.org
- Create free account

### Step 2: Create New Cron Job

| Field | Value |
|-------|-------|
| **URL** | `https://yourdomain.com/en/api/cron/subscriptions?token=YOUR_CRON_SECRET_TOKEN` |
| **Day of week** | * (Every day) |
| **Day of month** | * (Every day) |
| **Month** | * (Every month) |
| **Hour** | 7 |
| **Minute** | 0 |

**Explanation:** 7 AM UTC = 12 PM Pakistan time (UTC+5)

### Step 3: Save & Enable
- Click "Create Cronjob"
- Make sure it's **ENABLED**
- Test once by clicking "Run"

---

## 🗄️ Database Setup

### MongoDB Collections Created:
```javascript
db.subscriptions.createIndex({ user_id: 1 })
db.subscriptions.createIndex({ email: 1 })
db.subscriptions.createIndex({ status: 1 })
db.subscriptions.createIndex({ expiry_date: 1 })
db.subscriptions.createIndex({ created_at: -1 })
```

### Subscription Schema:
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  email: String,
  plan: "trial" | "starter",
  status: "active" | "expired" | "pending",
  amount: Number,
  expiry_date: Date,
  trial_days: Number (for trial plans),
  created_at: Date,
  activated_date: Date (nullable),
  billing_cycle_start: Date (nullable),
  billing_cycle_end: Date,
  next_billing_date: Date
}
```

---

## 🔄 Subscription Lifecycle

```
USER SIGNUP
    ↓
TRIAL CREATED (12 days, status: "active", amount: 0)
    ↓
[12 DAYS LATER - Cron Job Triggers]
    ↓
Trial marked as "expired"
    ↓
NEW PENDING SUBSCRIPTION CREATED (30 days, status: "pending", amount: PLAN_PRICE)
    ↓
[ADMIN ACTIVATES PAYMENT]
    ↓
Status changed to "active" + 30 day timer starts
    ↓
[30 DAYS LATER - Cron Job Triggers]
    ↓
Subscription marked as "expired"
    ↓
NEW PENDING SUBSCRIPTION CREATED (status: "pending")
    ↓
[CYCLE REPEATS...]
```

---

## 🧪 Testing Instructions

### Test URL (Production):
```
https://yourdomain.com/en/api/cron/subscriptions?token=YOUR_CRON_SECRET_TOKEN
```

### Expected Response (Success):
```json
{
  "success": true,
  "message": "Cron job executed successfully",
  "processedCount": 5,
  "createdCount": 3
}
```

### Error Response (Wrong Token):
```json
{
  "error": "Unauthorized - Invalid or missing token",
  "status": 401
}
```

### Test करने के लिए:

**PowerShell:**
```powershell
$url = "https://yourdomain.com/en/api/cron/subscriptions?token=YOUR_CRON_SECRET_TOKEN"
$response = Invoke-WebRequest -Uri $url -Method GET
$response.Content | ConvertFrom-Json | Format-List
```

**Browser:**
- Simply paste the URL in browser address bar (GET request)

---

## 📊 APIs Created

### 1. Subscription Status Endpoint
```
GET /{locale}/api/subscriptions/status
Authentication: NextAuth Session (User logged in required)

Response:
{
  "isActive": boolean,
  "isPending": boolean,
  "isExpired": boolean,
  "plan": "trial" | "starter",
  "daysRemaining": number,
  "expiryDate": Date,
  "status": "active" | "pending" | "expired"
}
```

### 2. Cron Job Endpoint
```
GET /{locale}/api/cron/subscriptions?token=CRON_SECRET_TOKEN
Authentication: Query Parameter Token
Required: CRON_SECRET_TOKEN must match env variable

Response:
{
  "success": true,
  "message": "Cron job executed successfully",
  "processedCount": number,
  "createdCount": number
}
```

---

## 🛡️ Security Checklist

- [ ] `CRON_SECRET_TOKEN` changed to strong random value
- [ ] Token NOT hardcoded in any files (only in .env)
- [ ] Cron-job.org setup with correct token in URL
- [ ] Database indexes created for performance
- [ ] Subscription status checks working in admin header
- [ ] Cron job tested manually at least once
- [ ] Production domain name in cron-job.org URL

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" on cron URL | Check token in .env matches URL token |
| Cron job not running | Check enabled on cron-job.org, timezone set to UTC |
| Subscriptions not expiring | Check expiry_date format in DB, run cron manually |
| Badge not showing in header | Check user is logged in, API endpoint accessible |
| Status endpoint 401 error | User not authenticated, check NextAuth session |

---

## 📝 Files Modified/Created

```
✅ src/app/[locale]/api/subscriptions/status/route.ts - NEW
✅ src/app/[locale]/api/cron/subscriptions/route.ts - MODIFIED
✅ src/components/subscription-status-badge.tsx - CREATED
✅ src/components/layout/admin-layout.tsx - MODIFIED
✅ src/lib/db/subscription.ts - HELPER FUNCTIONS
✅ src/lib/db/mongodb.ts - SUBSCRIPTIONS COLLECTION
✅ src/app/[locale]/api/auth/signup/route.ts - TRIAL CREATION
```

---

## 💡 Important Notes

1. **Cron job runs at 7 AM UTC (12 PM Pakistan time)** daily
2. **Pending subscriptions wait for admin activation** before 30-day timer starts
3. **Each user gets trial only once** - duplicate prevention implemented
4. **All paid subscriptions use "starter" plan** - single plan architecture
5. **Subscription status visible in admin header** in real-time
6. **Environment variables critical** - change CRON_SECRET_TOKEN before going live

---

## 📞 Support

Any issues? Check:
- `/[locale]/api/cron/subscriptions` endpoint logs
- MongoDB subscriptions collection status
- Cron-job.org execution history (shows success/failure)
- Browser console for subscription badge errors
- NextAuth session validation

---

**Created:** June 2, 2026
**System:** Dukan Khata - Subscription Management
**Status:** Ready for Production Deployment
