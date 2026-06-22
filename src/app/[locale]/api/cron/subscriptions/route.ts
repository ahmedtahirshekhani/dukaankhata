import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";
import nodemailer from "nodemailer";

const MAIL_HOST = process.env.MAIL_HOST || "smtp.gmail.com";
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_PASSWORD = (process.env.MAIL_PASSWORD || process.env.MAIL_PASS || "").replace(/\s+/g, "");
const MAIL_TLS_SERVERNAME = process.env.MAIL_TLS_SERVERNAME || "smtp.gmail.com";
const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

function createTransporter(port: number) {
  return nodemailer.createTransport({
    host: MAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASSWORD,
    },
    tls: {
      servername: MAIL_TLS_SERVERNAME,
      minVersion: "TLSv1.2",
    },
  });
}

async function sendMailWithFallback(options: nodemailer.SendMailOptions) {
  const orderedPorts = Array.from(new Set([MAIL_PORT, 465, 587]));
  let lastError: unknown;

  for (const port of orderedPorts) {
    try {
      const transporter = createTransporter(port);
      await transporter.sendMail(options);
      return { usedPort: port };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function runCronJob() {
  const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
  const now = new Date();

  // 1. Find subscriptions where trial/paid period has ended
  const expiredSubscriptions = await subscriptionsCollection
    .find({
      expiry_date: { $lte: now },
      status: { $in: ["active", "in_trial", "trial"] },
    })
    .toArray();

  let processedCount = 0;
  let createdCount = 0;
  let emailsSent = 0;
  let blockedCount = 0;

  for (const subscription of expiredSubscriptions) {
    try {
      // Mark as payment_expire
      await subscriptionsCollection.updateOne(
        { _id: subscription._id },
        {
          $set: {
            status: "payment_expire",
            updated_at: new Date(),
          },
        }
      );

      processedCount++;

      // Create new 30-day pending subscription for renewal
      const existingPending = await subscriptionsCollection.findOne({
        user_id: subscription.user_id,
        status: "pending",
      });

      if (!existingPending) {
        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);
        const planPrice = parseInt(process.env.NEXT_PUBLIC_PRO_PLAN_PRICE || "1000", 10);

        const planName = (process.env.NEXT_PUBLIC_PRO_PLAN_NAME || "pro").toLowerCase();

        await subscriptionsCollection.insertOne({
          user_id: subscription.user_id,
          email: subscription.email,
          plan: planName,
          status: "pending",
          amount: planPrice,
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
      }
    } catch (err) {
      console.error(`Error processing expired subscription ${subscription._id}:`, err);
    }
  }

  // 2. Process pending subscriptions for Grace Period logic
  const pendingSubscriptions = await subscriptionsCollection
    .find({ status: "pending" })
    .toArray();

  const gracePeriodDays = parseInt(process.env.GRACE_PERIOD_DAYS || "12", 10);
  const emailSubjectTemplate = process.env.GRACE_PERIOD_EMAIL_SUBJECT || "Action Required: Subscription Payment Reminder";
  const emailMsgTemplate = process.env.GRACE_PERIOD_EMAIL_MSG || "Dear user, your subscription expired on {{EXPIRY_DATE}}. Please renew.";

  for (const pendingSub of pendingSubscriptions) {
    try {
      // Get the old expiry date for the email message
      const oldSub = pendingSub.previous_subscription_id 
        ? await subscriptionsCollection.findOne({ _id: pendingSub.previous_subscription_id })
        : null;
      
      const expiryDateStr = oldSub && oldSub.expiry_date 
        ? new Date(oldSub.expiry_date).toLocaleDateString()
        : new Date(pendingSub.created_at).toLocaleDateString();

      // Days passed since pending subscription was created
      const daysPassed = Math.floor((now.getTime() - new Date(pendingSub.created_at).getTime()) / (1000 * 60 * 60 * 24));

      if (daysPassed > gracePeriodDays) {
        // Block the login
        await subscriptionsCollection.updateOne(
          { _id: pendingSub._id },
          {
            $set: {
              status: "login_blocked",
              updated_at: new Date(),
            },
          }
        );
        blockedCount++;
      } else {
        // Send reminder email
        const msg = emailMsgTemplate.replace("{{EXPIRY_DATE}}", expiryDateStr);
        if (pendingSub.email && MAIL_USER) {
          try {
             await sendMailWithFallback({
                from: MAIL_FROM,
                to: pendingSub.email,
                subject: emailSubjectTemplate,
                html: `<div style="font-family: sans-serif;"><p>${msg}</p></div>`,
             });
             emailsSent++;
          } catch(emailErr) {
             console.error(`Failed to send grace period email for ${pendingSub.email}:`, emailErr);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing pending subscription ${pendingSub._id}:`, err);
    }
  }

  return { processedCount, createdCount, emailsSent, blockedCount };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const expectedToken = process.env.CRON_SECRET_TOKEN || "default-secret-token";

    if (token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized - Invalid or missing token" }, { status: 401 });
    }

    const result = await runCronJob();

    return NextResponse.json({
      message: "Cron job completed successfully",
      ...result,
      timestamp: new Date().toISOString(),
      pakistanTime: new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }),
    }, { status: 200 });

  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({
      error: "Cron job failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const testToken = body.token || process.env.CRON_SECRET_TOKEN;

    if (testToken !== process.env.CRON_SECRET_TOKEN) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const result = await runCronJob();

    return NextResponse.json({
      message: "Manual cron job test completed",
      ...result,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error("Manual cron job error:", error);
    return NextResponse.json({
      error: "Manual cron job failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
