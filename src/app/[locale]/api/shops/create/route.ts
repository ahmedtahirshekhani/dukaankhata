import { NextRequest, NextResponse } from "next/server";
import { getCollection, COLLECTIONS, toObjectId } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const { name } = body;
    
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
    }

    const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
    
    // Create new shop
    // The shop must be owned by the REAL user creating it, not the current active workspace (user.id)
    const realUserId = (user as any).real_user_id || user.id;
    const result = await shopsCollection.insertOne({
      name: name.trim(),
      owner_user_id: toObjectId(realUserId),
      created_at: new Date(),
      updated_at: new Date(),
    });
    
    if (!result.insertedId) {
       return NextResponse.json({ error: "Failed to create shop" }, { status: 500 });
    }
    
    // Create default party: Walk In Customer for this shop
    try {
      const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
      await partiesCollection.insertOne({
        name: "Walk In Customer",
        type: "cash",
        user_id: result.insertedId, // Must be the new shop ID!
        owner_id: result.insertedId, // Legacy backward compatibility
        company_name: name.trim(),
        created_at: new Date(),
        updated_at: new Date(),
        is_default: true,
        description: "Auto-created cash account for this shop.",
        phone: null,
        email: null,
        address: null,
        opening_balance: 0,
        balance: 0,
        status: "active",
      });
    } catch (err) {
      console.error("Failed to create default party for new shop", err);
    }
    
    // Create default configurations for this shop
    try {
      const configCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);
      await configCollection.insertOne({
        user_id: result.insertedId,
        is_counterSale_enable: false,
        is_AI_Chat_Enable: true,
        is_Whatsapp_enable: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (err) {
      console.error("Failed to create configurations for new shop", err);
    }
    
    // Check if real user has any subscription record. If not (e.g. staff creating their first shop), create a trial.
    try {
      const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
      const existingSub = await subscriptionsCollection.findOne({ user_id: toObjectId(realUserId) });
      
      if (!existingSub) {
        const trialDays = parseInt(process.env.NEXT_PUBLIC_TRIAL_NUMBER_OF_DAYS || "14", 10);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + trialDays);

        await subscriptionsCollection.insertOne({
          user_id: toObjectId(realUserId),
          email: user.email,
          plan: "trial",
          status: "in_trial",
          amount: 0,
          trial_days: trialDays,
          created_at: new Date(),
          expiry_date: expiryDate,
          activated_date: new Date(),
          billing_cycle_start: new Date(),
          billing_cycle_end: expiryDate,
          next_billing_date: expiryDate,
        });
      }
    } catch (err) {
      console.error("Failed to check or create trial subscription on shop creation", err);
    }
    
    return NextResponse.json({
      success: true,
      shopId: result.insertedId.toString(),
      name: name.trim()
    });

  } catch (error: any) {
    console.error("Error creating shop:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
