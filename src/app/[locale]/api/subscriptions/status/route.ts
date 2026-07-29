import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/utils";
import { getSubscriptionStatus } from "@/lib/db/subscription";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use workspace_owner_id if available (so staff members check the owner's subscription)
    // Fallback to real_user_id, then id
    const targetUserId = (user as any).workspace_owner_id || (user as any).real_user_id || user.id;
    const subscriptionStatus = await getSubscriptionStatus(targetUserId);

    return NextResponse.json(subscriptionStatus, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch subscription status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch subscription status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
