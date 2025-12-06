import NextAuth from "next-auth";
import { authOptions } from "@/auth";

// Use a single handler for both methods to be compatible with next-auth v4 in the App Router
const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };
