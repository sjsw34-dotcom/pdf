import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { splitPDFIntoChunks } from "@/lib/translator";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let chunkUrls: string[] = [];

  try {
    const body = await request.json();
    chunkUrls = body.chunkUrls || [];

    if (chunkUrls.length === 0) {
      return NextResponse.json(
        { error: "No chunk URLs provided" },
        { status: 400 }
      );
    }

    // 1. Download and reassemble into full PDF buffer
    const chunks: Buffer[] = [];
    for (const url of chunkUrls) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to download chunk: ${res.status}`);
      chunks.push(Buffer.from(await res.arrayBuffer()));
    }
    const fullBuffer = Buffer.concat(chunks);

    // 2. Split into 5-page chunks using pdf-lib
    const pageChunks = await splitPDFIntoChunks(fullBuffer, 5);

    // 3. Store each page chunk to blob
    const uploadId = crypto.randomUUID();
    const pageChunkUrls: string[] = [];

    for (let i = 0; i < pageChunks.length; i++) {
      const blob = await put(
        `page-chunks/${uploadId}/chunk-${String(i).padStart(3, "0")}.pdf`,
        pageChunks[i],
        { access: "public", contentType: "application/pdf", addRandomSuffix: false }
      );
      pageChunkUrls.push(blob.url);
    }

    // 4. Clean up the raw upload chunks
    try {
      await Promise.all(chunkUrls.map((url) => del(url)));
    } catch {
      /* best-effort cleanup */
    }

    return NextResponse.json({
      pageChunkUrls,
      totalChunks: pageChunks.length,
    });
  } catch (error) {
    console.error("Split PDF error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `Split failed: ${message}` },
      { status: 500 }
    );
  }
}
