import { getCollection, COLLECTIONS, createIndexes } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
    
    // Check if index exists and drop it
    try {
      await customersCollection.dropIndex("email_1_user_id_1");
      console.log("Dropped email_1_user_id_1 index");
    } catch (e) {
      console.log("Index might not exist or already dropped:", e);
    }

    // Recreate indexes with new definition (sparse: true)
    await createIndexes();
    
    return NextResponse.json({ success: true, message: "Indexes updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fix indexes: " + error.message }, { status: 500 });
  }
}
