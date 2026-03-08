import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
    const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 10) || "MISSING";

    if (!hasToken) {
      return NextResponse.json({
        error: "BLOB_READ_WRITE_TOKEN is missing",
        envKeys: Object.keys(process.env).filter((k) => k.includes("BLOB")),
      });
    }

    // Test actual blob write
    const blob = await put("test/hello.txt", "blob works!", {
      access: "public",
    });

    // Clean up
    await del(blob.url);

    return NextResponse.json({
      success: true,
      tokenPrefix: tokenPrefix + "...",
      testUrl: blob.url,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
