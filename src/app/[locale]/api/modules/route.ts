import { NextResponse } from "next/server";
import { getCollection, COLLECTIONS } from "@/lib/db/mongodb";
import { getCurrentUser } from "@/lib/auth/utils";

export async function GET(req: Request) {
  try {
    try {
      await getCurrentUser();
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const modulesCollection = await getCollection(COLLECTIONS.MODULES);
    const permsColl = await getCollection(COLLECTIONS.PERMISSIONS);

    const modules = await modulesCollection.find({}).toArray();
    const allPerms = await permsColl.find({}).toArray();

    const modulesWithActions = modules.map(mod => {
      const actions = allPerms
        .filter(p => p.module_code === mod.code)
        .map(p => p.action);
      return {
        ...mod,
        actions
      };
    });

    return NextResponse.json(modulesWithActions);
  } catch (error) {
    console.error("Error fetching modules:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
