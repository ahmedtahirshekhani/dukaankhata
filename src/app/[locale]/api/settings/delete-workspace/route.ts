import { auth } from "@/auth";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();

    if (!password) {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    // Verify user password
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({
      email: session.user.email,
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    // Get active workspace ID
    const workspaceId = toObjectId(session.user.id);
    const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
    const currentShop = await shopsCollection.findOne({ _id: workspaceId });

    if (!currentShop) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Owner check: Only the owner of the shop can delete it
    const realUserId = (session.user as any).real_user_id || user._id.toString();
    const isOwner =
      currentShop.owner_user_id?.toString() === realUserId.toString() ||
      currentShop._id.toString() === realUserId.toString();

    if (!isOwner) {
      return Response.json(
        { error: "Only the workspace owner can delete this workspace" },
        { status: 403 }
      );
    }

    // Find other workspaces owned by this user
    const otherOwnedShops = await shopsCollection
      .find({
        owner_user_id: toObjectId(realUserId),
        _id: { $ne: workspaceId },
      })
      .toArray();

    // Also check if user is a staff in any other shop
    const userRolesColl = await getCollection(COLLECTIONS.USER_ROLES);
    const rolesColl = await getCollection(COLLECTIONS.ROLES);
    const userRoles = await userRolesColl
      .find({ user_id: toObjectId(realUserId) })
      .toArray();

    let otherStaffShopIds: string[] = [];
    if (userRoles.length > 0) {
      const roles = await rolesColl
        .find({ _id: { $in: userRoles.map((ur) => ur.role_id) } })
        .toArray();
      otherStaffShopIds = Array.from(
        new Set(roles.map((r) => r.owner_id.toString()))
      ).filter(
        (id) =>
          id !== workspaceId.toString() &&
          !otherOwnedShops.some((s) => s._id.toString() === id)
      );
    }

    const remainingCount = otherOwnedShops.length + otherStaffShopIds.length;
    const nextWorkspaceId =
      otherOwnedShops[0]?._id?.toString() || otherStaffShopIds[0] || null;

    console.log(`[DELETE_WORKSPACE] Deleting workspace ${workspaceId} (${currentShop.name}). Remaining workspaces: ${remainingCount}`);

    // Delete isolated data from all collections for this workspace
    const filter = { user_id: { $in: [workspaceId, workspaceId.toString()] } };
    const collectionsToClear = [
      COLLECTIONS.PRODUCTS,
      COLLECTIONS.PARTIES,
      COLLECTIONS.ORDERS,
      COLLECTIONS.ORDER_ITEMS,
      COLLECTIONS.PARTY_TRANSACTIONS,
      COLLECTIONS.VENDOR_TRANSACTIONS,
      COLLECTIONS.SALE_RETURN_TRANSACTIONS,
      COLLECTIONS.PURCHASE_BILLS,
      COLLECTIONS.PARTY_LEDGER_ENTRIES,
      COLLECTIONS.PARTY_BALANCE_STATE,
      COLLECTIONS.EXPENSES,
      COLLECTIONS.TRANSACTIONS,
      COLLECTIONS.QUOTATIONS,
      COLLECTIONS.CATEGORIES,
      COLLECTIONS.BRANCHES,
      COLLECTIONS.PAYMENT_METHODS,
      COLLECTIONS.CONFIGURATIONS,
    ];

    for (const collectionName of collectionsToClear) {
      const collection = await getCollection(collectionName);
      await collection.deleteMany(filter);
    }

    // Delete roles and permissions associated with this workspace
    const workspaceRoles = await rolesColl
      .find({ owner_id: { $in: [workspaceId, workspaceId.toString()] } })
      .toArray();
    if (workspaceRoles.length > 0) {
      const wRoleIds = workspaceRoles.map((r) => r._id);
      await userRolesColl.deleteMany({ role_id: { $in: wRoleIds } });
      const rolePermsColl = await getCollection(COLLECTIONS.ROLE_PERMISSIONS);
      await rolePermsColl.deleteMany({ role_id: { $in: wRoleIds } });
      await rolesColl.deleteMany({ _id: { $in: wRoleIds } });
    }

    // Delete pending invitations for this shop
    const invColl = await getCollection(COLLECTIONS.INVITATIONS);
    await invColl.deleteMany({
      $or: [
        { shop_id: { $in: [workspaceId, workspaceId.toString()] } },
        { owner_id: { $in: [workspaceId, workspaceId.toString()] } },
      ],
    });

    // Finally delete the shop record itself from SHOPS collection
    await shopsCollection.deleteOne({ _id: workspaceId });

    return Response.json({
      success: true,
      message: "Workspace and all associated data deleted successfully",
      remainingCount,
      nextWorkspaceId,
    });
  } catch (error) {
    console.error("[DELETE_WORKSPACE]", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
