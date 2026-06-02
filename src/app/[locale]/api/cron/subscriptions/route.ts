import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";

/**
 * Cron Job - Runs daily at 12 PM Pakistan time (UTC+5)
 * 
 * Tasks:
 * 1. Find subscriptions where trial/paid period has ended (expiry_date <= now)
 * 2. Mark them as "expired"
 * 3. Create new 30-day "pending" subscription for renewal
 * 
 * Usage: Set up a cron job at cron-job.org or similar service
 * URL: https://yourdomain.com/en/api/cron/subscriptions?token=YOUR_CRON_SECRET_TOKEN
 * Schedule: Every day at 12:00 PM (Pakistan time = UTC+5, so 7:00 AM UTC)
 * 
 * Cron expression: 0 7 * * * (7 AM UTC = 12 PM Pakistan)
 * 
 * TESTING:
 * - Localhost: http://localhost:3000/en/api/cron/subscriptions?token=super-secret-cron-token-change-this-in-production
 * - Production: https://yourdomain.com/en/api/cron/subscriptions?token=YOUR_CRON_SECRET_TOKEN
 */

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a trusted cron service using query parameter
    const token = request.nextUrl.searchParams.get("token");
    const expectedToken = process.env.CRON_SECRET_TOKEN || "default-secret-token";

    if (token !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing token" },
        { status: 401 }
      );
    }

    const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
    const now = new Date();

    // 1. Find all subscriptions that have expired
    const expiredSubscriptions = await subscriptionsCollection
      .find({
        expiry_date: { $lte: now },
        status: { $in: ["active", "trial"] }, // Only process active/trial subscriptions
      })
      .toArray();

    console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

    let processedCount = 0;
    let createdCount = 0;

    // 2. Process each expired subscription
    for (const subscription of expiredSubscriptions) {
      try {
        // Mark as expired
        await subscriptionsCollection.updateOne(
          { _id: subscription._id },
          {
            $set: {
              status: "expired",
              updated_at: new Date(),
            },
          }
        );

        processedCount++;

        // 3. Check if a pending subscription already exists for this user
        // This prevents creating duplicate pending subscriptions
        const existingPending = await subscriptionsCollection.findOne({
          user_id: subscription.user_id,
          status: "pending",
        });

        if (existingPending) {
          console.log(
            `Pending subscription already exists for user ${subscription.user_id}. Skipping creation.`
          );
          continue;
        }

        // 4. Create new 30-day pending subscription for renewal
        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);

        // All subscriptions use "starter" plan (only one plan available)
        const newPlan = "starter";

        // Get pricing from environment variable
        const planPrice = parseInt(process.env.PLAN_PRICE || "1000", 10);
        const newAmount = planPrice;

        await subscriptionsCollection.insertOne({
          user_id: subscription.user_id,
          email: subscription.email,
          plan: newPlan,
          status: "pending", // New subscription is pending payment
          amount: newAmount,
          created_at: new Date(),
          expiry_date: newExpiryDate,
          activated_date: null, // Will be set when admin activates
          billing_cycle_start: null,
          billing_cycle_end: newExpiryDate,
          next_billing_date: newExpiryDate,
          previous_subscription_id: subscription._id, // Track relationship
          is_renewal: true, // Mark as renewal (not first-time trial)
        });

        createdCount++;
      } catch (err) {
        console.error(`Error processing subscription ${subscription._id}:`, err);
      }
    }

    return NextResponse.json(
      {
        message: "Cron job completed successfully",
        processedSubscriptions: processedCount,
        newSubscriptionsCreated: createdCount,
        timestamp: new Date().toISOString(),
        pakistanTime: new Date().toLocaleString("en-US", {
          timeZone: "Asia/Karachi",
        }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Manual POST endpoint to test the cron job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const testToken = body.token || process.env.CRON_SECRET_TOKEN;

    if (testToken !== process.env.CRON_SECRET_TOKEN) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Run same logic as GET
    const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
    const now = new Date();

    const expiredSubscriptions = await subscriptionsCollection
      .find({
        expiry_date: { $lte: now },
        status: { $in: ["active", "trial"] },
      })
      .toArray();

    let processedCount = 0;
    let createdCount = 0;

    for (const subscription of expiredSubscriptions) {
      try {
        await subscriptionsCollection.updateOne(
          { _id: subscription._id },
          {
            $set: {
              status: "expired",
              updated_at: new Date(),
            },
          }
        );

        processedCount++;

        // Check if a pending subscription already exists for this user
        const existingPending = await subscriptionsCollection.findOne({
          user_id: subscription.user_id,
          status: "pending",
        });

        if (existingPending) {
          console.log(
            `Pending subscription already exists for user ${subscription.user_id}. Skipping creation.`
          );
          continue;
        }

        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);

        // All subscriptions use "starter" plan (only one plan available)
        const newPlan = "starter";

        // Get pricing from environment variable
        const planPrice = parseInt(process.env.PLAN_PRICE || "1000", 10);
        const newAmount = planPrice;

        await subscriptionsCollection.insertOne({
          user_id: subscription.user_id,
          email: subscription.email,
          plan: newPlan,
          status: "pending",
          amount: newAmount,
          created_at: new Date(),
          expiry_date: newExpiryDate,
          activated_date: null,
          billing_cycle_start: null,
          billing_cycle_end: newExpiryDate,
          next_billing_date: newExpiryDate,
          previous_subscription_id: subscription._id,
          is_renewal: true,
        });

        createdCount++;
      } catch (err) {
        console.error(`Error processing subscription ${subscription._id}:`, err);
      }
    }

    return NextResponse.json(
      {
        message: "Manual cron job test completed",
        processedSubscriptions: processedCount,
        newSubscriptionsCreated: createdCount,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Manual cron job error:", error);
    return NextResponse.json(
      {
        error: "Manual cron job failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
