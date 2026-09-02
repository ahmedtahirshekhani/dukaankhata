import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import nodemailer from "nodemailer";

const MAIL_HOST = process.env.MAIL_HOST || "smtp.gmail.com";
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_PASSWORD = (process.env.MAIL_PASSWORD || process.env.MAIL_PASS || "").replace(/\s+/g, "");
const MAIL_TLS_SERVERNAME = process.env.MAIL_TLS_SERVERNAME || "smtp.gmail.com";
const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterPort: number | null = null;

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
  if (cachedTransporter) {
    try {
      await cachedTransporter.sendMail(options);
      return { usedPort: cachedTransporterPort };
    } catch {
      cachedTransporter = null;
      cachedTransporterPort = null;
    }
  }

  const orderedPorts = Array.from(new Set([MAIL_PORT, 465, 587]));
  let lastError: unknown;

  for (const port of orderedPorts) {
    try {
      const transporter = createTransporter(port);
      await transporter.sendMail(options);
      cachedTransporter = transporter;
      cachedTransporterPort = port;
      return { usedPort: port };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function getSecretToken(): string | null {
  return process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET || null;
}

function isAuthorized(request: NextRequest, bodyToken?: string): boolean {
  const secretToken = getSecretToken();
  if (!secretToken) {
    // Return false if secret token is missing in .env to prevent unauthorized access
    return false;
  }

  // 1. Check URL query param: ?token=...
  const queryToken = request.nextUrl.searchParams.get("token");
  if (queryToken && queryToken === secretToken) {
    return true;
  }

  // 2. Check Authorization header: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === secretToken) {
      return true;
    }
  }

  // 3. Check x-cron-secret header
  const xCronSecret = request.headers.get("x-cron-secret");
  if (xCronSecret && xCronSecret === secretToken) {
    return true;
  }

  // 4. Check POST body token
  if (bodyToken && bodyToken === secretToken) {
    return true;
  }

  return false;
}

async function runCronJob() {
  const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
  const usersCollection = await getCollection(COLLECTIONS.USERS);
  const now = new Date();

  // 0. Fetch all deleted users to prevent processing subscriptions or sending emails to them
  const deletedUsers = await usersCollection
    .find({ isDeleted: true }, { projection: { _id: 1 } })
    .toArray();

  const deletedUserIds = deletedUsers.map((u) => u._id);
  const deletedUserIdStrings = deletedUsers.map((u) => u._id.toString());
  const allDeletedUserIdentifiers = [...deletedUserIds, ...deletedUserIdStrings];

  // Auto-cancel lingering active/trial/pending subscriptions for deleted accounts
  if (allDeletedUserIdentifiers.length > 0) {
    await subscriptionsCollection.updateMany(
      {
        user_id: { $in: allDeletedUserIdentifiers },
        status: { $in: ["active", "in_trial", "trial", "pending", "payment_expire"] },
      },
      {
        $set: {
          status: "cancelled",
          updated_at: new Date(),
        },
      }
    );
  }

  let processedCount = 0;
  let createdCount = 0;
  let emailsSent = 0;
  let blockedCount = 0;

  // 1. Find subscriptions where trial/paid period has ended (excluding deleted users)
  const expiredSubscriptions = await subscriptionsCollection
    .find({
      expiry_date: { $lte: now },
      status: { $in: ["active", "in_trial", "trial"] },
      user_id: { $nin: allDeletedUserIdentifiers },
    })
    .toArray();

  if (expiredSubscriptions.length > 0) {
    // Bulk fetch existing pending subscriptions for all affected users in 1 query
    const expiredUserIds = expiredSubscriptions.map((s) => s.user_id);
    const existingPendingList = await subscriptionsCollection
      .find({
        user_id: { $in: expiredUserIds },
        status: "pending",
      })
      .toArray();

    const pendingUserSet = new Set(existingPendingList.map((p) => p.user_id.toString()));

    const planPrice = parseInt(process.env.NEXT_PUBLIC_PRO_PLAN_PRICE || "1000", 10);
    const planName = (process.env.NEXT_PUBLIC_PRO_PLAN_NAME || "pro").toLowerCase();

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

        const userKey = subscription.user_id ? subscription.user_id.toString() : "";
        if (userKey && !pendingUserSet.has(userKey)) {
          const newExpiryDate = new Date();
          newExpiryDate.setDate(newExpiryDate.getDate() + 30);

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

          pendingUserSet.add(userKey);
          createdCount++;
        }
      } catch (err) {
        console.error(`Error processing expired subscription ${subscription._id}:`, err);
      }
    }
  }

  // 2. Process pending subscriptions for Grace Period logic (excluding deleted users)
  const pendingSubscriptions = await subscriptionsCollection
    .find({
      status: "pending",
      user_id: { $nin: allDeletedUserIdentifiers },
    })
    .toArray();

  if (pendingSubscriptions.length > 0) {
    const gracePeriodDays = parseInt(process.env.GRACE_PERIOD_DAYS || "12", 10);
    const emailSubjectTemplate =
      process.env.GRACE_PERIOD_EMAIL_SUBJECT || "Action Required: Subscription Payment Reminder";
    const emailMsgTemplate =
      process.env.GRACE_PERIOD_EMAIL_MSG ||
      "Dear user, your subscription expired on {{EXPIRY_DATE}}. Please renew.";
    const emailIntervalDays = parseInt(process.env.GRACE_PERIOD_EMAIL_INTERVAL_DAYS || "3", 10);

    // Bulk fetch previous subscriptions for all pending subscriptions in 1 query
    const previousSubIds = pendingSubscriptions
      .map((p) => p.previous_subscription_id)
      .filter(Boolean)
      .map((id) => toObjectId(id));

    const oldSubs =
      previousSubIds.length > 0
        ? await subscriptionsCollection.find({ _id: { $in: previousSubIds } }).toArray()
        : [];

    const oldSubsMap = new Map(oldSubs.map((s) => [s._id.toString(), s]));

    const emailsToSend: Array<{ pendingSub: (typeof pendingSubscriptions)[0]; expiryDateStr: string }> = [];

    for (const pendingSub of pendingSubscriptions) {
      try {
        const oldSubKey = pendingSub.previous_subscription_id
          ? pendingSub.previous_subscription_id.toString()
          : "";
        const oldSub = oldSubsMap.get(oldSubKey);

        const expiryDateObj = oldSub?.expiry_date || pendingSub.created_at;
        const expiryDateStr = new Date(expiryDateObj).toISOString().split("T")[0]; // YYYY-MM-DD

        const daysPassed = Math.floor(
          (now.getTime() - new Date(pendingSub.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysPassed > gracePeriodDays) {
          // Block login
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
          const lastSent = pendingSub.last_reminder_sent_at
            ? new Date(pendingSub.last_reminder_sent_at)
            : null;
          let shouldSend = false;

          if (!lastSent) {
            shouldSend = true;
          } else {
            const daysSinceLastEmail = Math.floor(
              (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastEmail >= emailIntervalDays) {
              shouldSend = true;
            }
          }

          if (shouldSend && pendingSub.email && MAIL_USER) {
            emailsToSend.push({ pendingSub, expiryDateStr });
          }
        }
      } catch (err) {
        console.error(`Error processing pending subscription ${pendingSub._id}:`, err);
      }
    }

    // Parallel send emails in small concurrency batches (5 at a time)
    const BATCH_SIZE = 5;
    for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
      const batch = emailsToSend.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ pendingSub, expiryDateStr }) => {
          try {
            const msg = emailMsgTemplate.replace("{{EXPIRY_DATE}}", expiryDateStr);
            await sendMailWithFallback({
              from: MAIL_FROM,
              to: pendingSub.email,
              subject: emailSubjectTemplate,
              html: `<div style="font-family: sans-serif;"><p>${msg}</p></div>`,
            });
            emailsSent++;

            await subscriptionsCollection.updateOne(
              { _id: pendingSub._id },
              { $set: { last_reminder_sent_at: new Date() } }
            );
          } catch (emailErr) {
            console.error(`Failed to send grace period email for ${pendingSub.email}:`, emailErr);
          }
        })
      );
    }
  }

  return { processedCount, createdCount, emailsSent, blockedCount };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing secret token" },
        { status: 401 }
      );
    }

    const result = await runCronJob();

    return NextResponse.json(
      {
        message: "Cron job completed successfully",
        ...result,
        timestamp: new Date().toISOString(),
        pakistanTime: new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }),
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

export async function POST(request: NextRequest) {
  try {
    let bodyToken: string | undefined;
    try {
      const body = await request.json();
      bodyToken = body?.token;
    } catch {
      // Body might be empty or non-JSON
    }

    if (!isAuthorized(request, bodyToken)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing secret token" },
        { status: 401 }
      );
    }

    const result = await runCronJob();

    return NextResponse.json(
      {
        message: "Manual cron job test completed",
        ...result,
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
