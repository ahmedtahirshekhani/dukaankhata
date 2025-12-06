import { auth } from "@/auth";
import type { Session } from "next-auth";

export async function getCurrentUser() {
  const session: Session | null = await auth();
  return session?.user as any;
}

export async function getCurrentSession() {
  return (await auth()) as Session | null;
}
