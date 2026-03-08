import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { translateChunkWithRetry } from "@/lib/translator";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, chunkNum, totalChunks } = body;

    if (!url || chunkNum == null || totalChunks == null) {
      return NextResponse.json(
        { error: "Missing required fields: url, chunkNum, totalChunks" },
        { status: 400 }
      );
    }

    // 1. Download the page chunk from blob
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download page chunk: ${res.status}`);
    }
    const chunkBuffer = Buffer.from(await res.arrayBuffer());
    const base64Chunk = chunkBuffer.toString("base64");

    // 2. Call Claude to translate
    const client = new Anthropic();
    const text = await translateChunkWithRetry(
      client,
      base64Chunk,
      chunkNum,
      totalChunks
    );

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Translate chunk error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `Translation failed: ${message}` },
      { status: 500 }
    );
  }
}
