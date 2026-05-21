import { getServerSession } from "next-auth";
import { auth } from "@/auth";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { password, reason } = await request.json();

    if (!password) {
      return Response.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return Response.json(
        { error: "Reason for deletion is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({
      email: session.user.email,
    });

    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return Response.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Mark user as deleted
    await usersCollection.updateOne(
      { _id: toObjectId(user._id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletionReason: reason,
        },
      }
    );

    return Response.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return Response.json(
      { error: error?.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
