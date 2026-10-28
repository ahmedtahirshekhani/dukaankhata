import { NextRequest, NextResponse } from "next/server";
import { DELETE as baseDelete, PUT as basePut } from "../route";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  url.searchParams.set("id", id);
  const mutatedRequest = new NextRequest(url, request);
  return baseDelete(mutatedRequest);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  body.id = body.id || id;
  const mutatedRequest = new NextRequest(request.url, {
    method: "PUT",
    headers: request.headers,
    body: JSON.stringify(body),
  });
  return basePut(mutatedRequest);
}
