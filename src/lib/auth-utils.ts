import { auth } from "@/auth";
import type { Session } from "next-auth";

export async function getCurrentUser() {
  const session: Session | null = await auth();
  const user = session?.user as any;
  
  if (!user?.id) {
    throw new Error('User not authenticated or missing user id');
  }
  
  return user;
}

export async function getCurrentSession() {
  return (await auth()) as Session | null;
}
