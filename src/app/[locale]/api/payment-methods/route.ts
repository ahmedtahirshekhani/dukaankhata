import { NextResponse } from 'next/server';
import { getCollection, COLLECTIONS } from '@/lib/mongodb';

export async function GET() {
  const paymentMethodsCollection = await getCollection(COLLECTIONS.PAYMENT_METHODS);

  const data = await paymentMethodsCollection
    .find({}, { projection: { _id: 1, name: 1 } })
    .toArray();

  // Convert _id to id
  const paymentMethods = data.map(method => ({
    id: method._id.toString(),
    name: method.name,
  }));

  return NextResponse.json(paymentMethods);
}
