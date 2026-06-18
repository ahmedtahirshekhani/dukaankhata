import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Db, MongoClient } from "mongodb";

type AggregationRow = {
  _id: unknown;
  document_count: number;
  last_created_at: Date | null;
  last_updated_at: Date | null;
};

type CsvRow = {
  user_id: string;
  user_email: string;
  user_name: string;
  document_count: number;
  last_created_at: string;
  last_updated_at: string;
  inactive_more_than_1_month: number;
};

const MONGODB_URL = process.env.MONGODB_URL;
const DB_NAME = process.env.MONGODB_DB_NAME || "dukaankhata";
const USER_FIELD = process.env.MONGODB_USER_FIELD || "user_id";

if (!MONGODB_URL) {
  throw new Error("Missing MONGODB_URL in environment.");
}

function parseOutputPath() {
  const modeArg = process.argv[2];
  const flagIndex = process.argv.indexOf("--output");
  const outputFromFlag = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
  const reportDate = new Date().toISOString().slice(0, 10);
  const reportFolder = modeArg === "prod" ? "reports/prod" : "reports/dev";

  if (modeArg && modeArg !== "dev" && modeArg !== "prod" && modeArg !== "--output") {
    throw new Error('Usage: npm run export:collection-activity -- dev|prod [--output <path>]');
  }

  const output =
    outputFromFlag ||
    path.join(reportFolder, `collection-activity-${reportDate}.csv`);

  return path.resolve(process.cwd(), output);
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString() : "";
}

async function getCollectionNames(db: Db): Promise<string[]> {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return collections
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith("system."));
}

async function getUserLookup(db: Db): Promise<Map<string, { email: string; name: string }>> {
  const users = await db
    .collection("users")
    .find({}, { projection: { email: 1, name: 1, company_name: 1 } })
    .toArray();

  const lookup = new Map<string, { email: string; name: string }>();

  for (const user of users) {
    lookup.set(String(user._id), {
      email: user.email || "",
      name: user.name || user.company_name || "",
    });
  }

  return lookup;
}

async function aggregateCollection(db: Db, collectionName: string): Promise<AggregationRow[]> {
  return db.collection(collectionName).aggregate<AggregationRow>([
    {
      $match: {
        [USER_FIELD]: { $exists: true, $ne: null },
      },
    },
    {
      $project: {
        user_key: `$${USER_FIELD}`,
        created_at_value: {
          $convert: {
            input: {
              $ifNull: ["$created_at", { $ifNull: ["$createdAt", null] }],
            },
            to: "date",
            onError: null,
            onNull: null,
          },
        },
        updated_at_value: {
          $convert: {
            input: {
              $ifNull: ["$updated_at", { $ifNull: ["$updatedAt", null] }],
            },
            to: "date",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $group: {
        _id: "$user_key",
        document_count: { $sum: 1 },
        last_created_at: { $max: "$created_at_value" },
        last_updated_at: { $max: "$updated_at_value" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]).toArray();
}

async function main() {
  const outputPath = parseOutputPath();
  const client = new MongoClient(MONGODB_URL!);

  await client.connect();
  console.log("Connected to MongoDB.");

  try {
    const db = client.db(DB_NAME);
    const collectionNames = await getCollectionNames(db);
    const userLookup = await getUserLookup(db);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const userRows = new Map<
      string,
      {
        user_id: string;
        user_email: string;
        user_name: string;
        document_count: number;
        last_created_at: Date | null;
        last_updated_at: Date | null;
      }
    >();

    for (const collectionName of collectionNames) {
      const aggregatedRows = await aggregateCollection(db, collectionName);

      for (const row of aggregatedRows) {
        const userId = String(row._id);
        const user = userLookup.get(userId);
        const existing = userRows.get(userId);

        userRows.set(userId, {
          user_id: userId,
          user_email: user?.email || existing?.user_email || "",
          user_name: user?.name || existing?.user_name || "",
          document_count: (existing?.document_count || 0) + row.document_count,
          last_created_at: existing?.last_created_at
            ? row.last_created_at && row.last_created_at > existing.last_created_at
              ? row.last_created_at
              : existing.last_created_at
            : row.last_created_at,
          last_updated_at: existing?.last_updated_at
            ? row.last_updated_at && row.last_updated_at > existing.last_updated_at
              ? row.last_updated_at
              : existing.last_updated_at
            : row.last_updated_at,
        });
      }
    }

    const rows: CsvRow[] = Array.from(userRows.values())
      .map((row) => ({
        user_id: row.user_id,
        user_email: row.user_email,
        user_name: row.user_name,
        document_count: row.document_count,
        last_created_at: formatDate(row.last_created_at),
        last_updated_at: formatDate(row.last_updated_at),
        inactive_more_than_1_month:
          !row.last_created_at && !row.last_updated_at
            ? 1
            : (() => {
                const lastActivityAt =
                  row.last_created_at && row.last_updated_at
                    ? row.last_created_at > row.last_updated_at
                      ? row.last_created_at
                      : row.last_updated_at
                    : row.last_created_at || row.last_updated_at;

                return lastActivityAt && lastActivityAt < oneMonthAgo ? 1 : 0;
              })(),
      }))
      .sort((left, right) => left.user_name.localeCompare(right.user_name));

    const headers = [
      "user_id",
      "user_email",
      "user_name",
      "document_count",
      "last_created_at",
      "last_updated_at",
      "inactive_more_than_1_month",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.user_id,
          row.user_email,
          row.user_name,
          row.document_count,
          row.last_created_at,
          row.last_updated_at,
          row.inactive_more_than_1_month,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv, "utf8");

    console.log(`Exported ${rows.length} rows to ${outputPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to export collection activity:", error);
  process.exit(1);
});