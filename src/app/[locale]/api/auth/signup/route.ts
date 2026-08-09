import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      name,
      companyName,
      phone,
      phoneCountryCode,
      phoneNumber,
    } = body;

    // Validation
    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const countryCode = String(phoneCountryCode || "+92").trim();
    if (!/^\+\d{1,4}$/.test(countryCode)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 },
      );
    }

    const rawPhoneValue = String(phoneNumber ?? phone ?? "").trim();
    if (!rawPhoneValue) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const localDigits = rawPhoneValue.replace(/\D/g, "");
    const normalizedLocalPhone = localDigits;
    const normalizedPhone = `${countryCode}${normalizedLocalPhone}`;

    if (normalizedLocalPhone.length < 5) {
      return NextResponse.json(
        { error: "Invalid phone number - too short" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 },
      );
    }

    const existingPhone = await usersCollection.findOne({
      phone: normalizedPhone,
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: "Phone number already registered" },
        { status: 400 },
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await usersCollection.insertOne({
      email,
      password_hash: passwordHash,
      name,
      phone: normalizedPhone,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    const newUser = await usersCollection.findOne({ _id: result.insertedId });

    // Create the default shop for the user
    try {
      const shopsCollection = await getCollection(COLLECTIONS.SHOPS);
      await shopsCollection.insertOne({
        _id: result.insertedId,
        name: companyName,
        owner_user_id: result.insertedId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (err) {
      console.error("Failed to create default shop for user", err);
    }

    // Create default party: Walk In Customer
    try {
      const partiesCollection = await getCollection(COLLECTIONS.PARTIES);
      await partiesCollection.insertOne({
        name: "Walk In Customer",
        type: "cash",
        user_id: newUser?._id,
        company_name: companyName,
        created_at: new Date(),
        updated_at: new Date(),
        is_default: true,
        description: "Auto-created cash account for this user.",
        phone: null,
        email: null,
        address: null,
        opening_balance: 0,
        balance: 0,
        status: "active",
      });
    } catch (err) {
      // Log but don't block signup
      console.error("Failed to create default party for user", err);
    }

    // Create default payment method: Cash in Hand
    try {
      const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);
      await paymentMethodsCollection.insertOne({
        user_id: newUser?._id,
        bank_name: "Cash in Hand",
        bank_details: "Auto-created cash account",
        opening_balance: 0,
        current_balance: 0,
        created_at: new Date(),
        updated_at: new Date(),
        is_default: true,
        status: "active"
      });
    } catch (err) {
      // Log but don't block signup
      console.error("Failed to create default payment method for user", err);
    }

    // Create trial subscription
    try {
      const subscriptionsCollection = await getCollection(COLLECTIONS.SUBSCRIPTIONS);
      const trialDays = parseInt(process.env.NEXT_PUBLIC_TRIAL_NUMBER_OF_DAYS || "14", 10);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + trialDays);

      await subscriptionsCollection.insertOne({
        user_id: newUser?._id,
        email: email,
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
    } catch (err) {
      // Log but don't block signup
      console.error("Failed to create trial subscription for user", err);
    }

    // Create default configurations
    try {
      const configCollection = await getCollection(COLLECTIONS.CONFIGURATIONS);
      await configCollection.insertOne({
        user_id: newUser?._id,
        is_counterSale_enable: false,
        is_AI_Chat_Enable: true,
        is_Whatsapp_enable: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (err) {
      console.error("Failed to create configurations for user", err);
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser?._id.toString(),
          email: newUser?.email,
          name: newUser?.name,
          companyName: companyName,
          phone: newUser?.phone,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
