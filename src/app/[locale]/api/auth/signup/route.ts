import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection, COLLECTIONS } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName } = body;

    // Validation
    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
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
      company_name: companyName,
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (!result.insertedId) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const newUser = await usersCollection.findOne({ _id: result.insertedId });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: newUser?._id.toString(),
          email: newUser?.email,
          name: newUser?.name,
          companyName: newUser?.company_name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
