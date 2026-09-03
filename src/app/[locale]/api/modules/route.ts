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

    const [modules, allPerms] = await Promise.all([
      modulesCollection.find({ isActive: true }, { projection: { code: 1, name: 1, description: 1 } }).toArray(),
      permsColl.find({ isActive: true }, { projection: { module_code: 1, action: 1 } }).toArray()
    ]);

    const actionsByModule = new Map<string, string[]>();
    for (const p of allPerms) {
      if (!actionsByModule.has(p.module_code)) {
        actionsByModule.set(p.module_code, []);
      }
      actionsByModule.get(p.module_code)!.push(p.action);
    }

    const modulesWithActions = modules.map(mod => ({
      ...mod,
      actions: actionsByModule.get(mod.code) || []
    }));

    return NextResponse.json(modulesWithActions, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("Error fetching modules:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
