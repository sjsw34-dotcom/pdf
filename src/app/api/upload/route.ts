import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as File | null;
    const uploadId = formData.get("uploadId") as string;
    const chunkIndex = formData.get("chunkIndex") as string;

    if (!chunk || !uploadId || chunkIndex === null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const blob = await put(
      `uploads/${uploadId}/chunk-${chunkIndex.padStart(3, "0")}`,
      Buffer.from(arrayBuffer),
      { access: "private" }
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
