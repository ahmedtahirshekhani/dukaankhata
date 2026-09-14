import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

export interface Subscription {
  _id?: ObjectId;
  user_id: ObjectId | string;
  email: string;
  plan: "trial" | "pro";
  status: "pending" | "active" | "expired" | "cancelled" | "login_blocked" | "payment_expire" | "in_trial" | "trial";
  amount: number;
  trial_days?: number;
  created_at: Date;
  expiry_date: Date;
  activated_date?: Date | null;
  billing_cycle_start?: Date | null;
  billing_cycle_end: Date;
  next_billing_date: Date;
  previous_subscription_id?: ObjectId;
  updated_at?: Date;
}

/**
 * Get user's current active subscription
 */
export async function getUserActiveSubscription(userId: string | ObjectId): Promise<Subscription | null> {
  const subscriptionsCollection = await getCollection<Subscription>(COLLECTIONS.SUBSCRIPTIONS);
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  const userObjectId = typeof userId === "string" ? toObjectId(userId) : userId;
  const now = new Date();

  const user = await usersCollection.findOne({ _id: userObjectId }, { projection: { email: 1 } });
  const userEmail = user?.email;

  const userOrEmailFilter: any = userEmail
    ? { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }, { email: userEmail }] }
    : { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }] };

  const subscriptions = await subscriptionsCollection
    .find({
      ...userOrEmailFilter,
      status: { $in: ["active", "in_trial", "trial"] },
    } as any)
    .sort({ expiry_date: -1 })
    .toArray();

  const activeSub = subscriptions.find((sub) => new Date(sub.expiry_date) > now);
  return activeSub || null;
}

export async function getUserLatestSubscription(userId: string | ObjectId): Promise<Subscription | null> {
  const subscriptionsCollection = await getCollection<Subscription>(COLLECTIONS.SUBSCRIPTIONS);
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  const userObjectId = typeof userId === "string" ? toObjectId(userId) : userId;
  const now = new Date();

  const user = await usersCollection.findOne({ _id: userObjectId }, { projection: { email: 1 } });
  const userEmail = user?.email;

  const userOrEmailFilter: any = userEmail
    ? { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }, { email: userEmail }] }
    : { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }] };

  // First priority: active subscription that hasn't expired yet
  const activeSubscriptions = await subscriptionsCollection
    .find({
      ...userOrEmailFilter,
      status: { $in: ["active", "in_trial", "trial"] },
    } as any)
    .sort({ expiry_date: -1 })
    .toArray();

  const activeSubscription = activeSubscriptions.find(
    (sub) => new Date(sub.expiry_date) > now
  );

  if (activeSubscription) {
    return activeSubscription;
  }

  // Fallback: latest created non-cancelled subscription record
  const nonCancelledSub = await subscriptionsCollection.findOne(
    {
      ...userOrEmailFilter,
      status: { $ne: "cancelled" },
    } as any,
    { sort: { created_at: -1 } }
  );

  if (nonCancelledSub) {
    return nonCancelledSub;
  }

  // Ultimate fallback: latest created subscription record
  const subscription = await subscriptionsCollection.findOne(
    userOrEmailFilter as any,
    { sort: { created_at: -1 } }
  );

  return subscription || null;
}

/**
 * Check if user has active subscription (trial or paid)
 */
export async function hasActiveSubscription(userId: string | ObjectId): Promise<boolean> {
  const subscription = await getUserActiveSubscription(userId);
  if (!subscription) return false;

  return new Date(subscription.expiry_date) > new Date();
}

/**
 * Get user's subscription status details
 */
export async function getSubscriptionStatus(userId: string | ObjectId): Promise<{
  isActive: boolean;
  isPending: boolean;
  isExpired: boolean;
  plan: string;
  daysRemaining: number;
  expiryDate: Date | null;
  startDate: Date | null;
  status: string;
  isRenewal: boolean;
}> {
  const subscription = await getUserLatestSubscription(userId);

  if (!subscription) {
    return {
      isActive: false,
      isPending: false,
      isExpired: true,
      plan: "none",
      daysRemaining: 0,
      expiryDate: null,
      startDate: null,
      status: "no_subscription",
      isRenewal: false,
    };
  }

  const now = new Date();
  const subExpiryDate = subscription.expiry_date ? new Date(subscription.expiry_date) : null;
  const daysRemaining = subExpiryDate
    ? Math.ceil((subExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const subscriptionsCollection = await getCollection<Subscription>(COLLECTIONS.SUBSCRIPTIONS);
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  const userObjectId = typeof userId === "string" ? toObjectId(userId) : userId;
  const user = await usersCollection.findOne({ _id: userObjectId }, { projection: { email: 1 } });
  const userEmail = user?.email;

  const countFilter: any = userEmail
    ? { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }, { email: userEmail }] }
    : { $or: [{ user_id: userObjectId }, { user_id: userId.toString() }] };

  const subscriptionCount = await subscriptionsCollection.countDocuments(countFilter);
  const isRenewal = subscriptionCount > 1 || !!subscription.previous_subscription_id;

  const isActive =
    ["active", "in_trial", "trial"].includes(subscription.status) &&
    !!subExpiryDate &&
    subExpiryDate > now;

  return {
    isActive,
    isPending: !isActive && subscription.status === "pending",
    isExpired: !isActive,
    plan: subscription.plan,
    daysRemaining: Math.max(0, daysRemaining),
    expiryDate: subExpiryDate,
    startDate: subscription.billing_cycle_start ? new Date(subscription.billing_cycle_start) : subscription.created_at ? new Date(subscription.created_at) : null,
    status: isActive
      ? subscription.status
      : subscription.status === "active"
      ? "expired"
      : subscription.status,
    isRenewal,
  };
}

/**
 * Get pending subscriptions that need activation
 */
export async function getPendingSubscriptions(): Promise<Subscription[]> {
  const subscriptionsCollection = await getCollection<Subscription>(COLLECTIONS.SUBSCRIPTIONS);

  return await subscriptionsCollection
    .find({
      status: "pending",
    })
    .sort({ created_at: -1 })
    .toArray();
}

/**
 * Activate subscription (admin action after payment)
 */
export async function activateSubscription(subscriptionId: string | ObjectId): Promise<boolean> {
  const subscriptionsCollection = await getCollection<Subscription>(COLLECTIONS.SUBSCRIPTIONS);
  const subscriptionObjectId = typeof subscriptionId === "string" ? toObjectId(subscriptionId) : subscriptionId;

  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now

  const result = await subscriptionsCollection.updateOne(
    { _id: subscriptionObjectId },
    {
      $set: {
        status: "active",
        activated_date: now,
        billing_cycle_start: now,
        billing_cycle_end: expiryDate,
        next_billing_date: expiryDate,
        updated_at: now,
      },
    }
  );

  return result.modifiedCount > 0;
}

/**
 * Get plan limits (features/item counts per plan)
 */
export function getPlanLimits(plan: string): {
  maxItems: number;
  maxParties: number;
  maxUsers: number;
  price: number;
  features: string[];
} {
  const planPrice = parseInt(process.env.NEXT_PUBLIC_PRO_PLAN_PRICE || "1000", 10);

  const plans: Record<
    string,
    {
      maxItems: number;
      maxParties: number;
      maxUsers: number;
      price: number;
      features: string[];
    }
  > = {
    trial: {
      maxItems: 50,
      maxParties: 10,
      maxUsers: 1,
      price: 0,
      features: ["basic_reports", "basic_analytics"],
    },
    starter: {
      maxItems: 999999,
      maxParties: 999999,
      maxUsers: 999999,
      price: planPrice,
      features: [
        "all_features",
        "basic_reports",
        "advanced_analytics",
        "customer_ledger",
        "profit_loss_reports",
        "email_invoices",
        "api_access",
      ],
    },
  };

  return (
    plans[plan] || {
      maxItems: 50,
      maxParties: 10,
      maxUsers: 1,
      price: 0,
      features: [],
    }
  );
}

/**
 * Check if user can perform an action based on subscription
 */
export async function canUserPerformAction(
  userId: string | ObjectId,
  action: "add_item" | "add_party" | "add_user" | "generate_report"
): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await getUserLatestSubscription(userId);

  if (!subscription || subscription.status !== "active") {
    return { allowed: false, reason: "No active subscription" };
  }

  if (subscription.expiry_date <= new Date()) {
    return { allowed: false, reason: "Subscription expired" };
  }

  // Add more specific checks based on plan limits here
  // This is a basic template

  return { allowed: true };
}
