import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function PUT(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const blob = await put(filename, request.body, {
    access: "public",
  });

  return NextResponse.json(blob);
}
