import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { translateSajuPDF } from "@/lib/translator";
import { generatePDF } from "@/lib/pdf-generator-v2";
import { generateLovePDF } from "@/lib/pdf-generator-love";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let chunkUrls: string[] = [];

  try {
    const body = await request.json();
    const { chunkUrls: urls, type: reportType = "general" } = body as {
      chunkUrls: string[];
      type?: string;
    };

    if (!urls || urls.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    chunkUrls = urls;

    // Download and reassemble chunks
    const chunks: Buffer[] = [];
    for (const url of chunkUrls) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to download chunk");
      chunks.push(Buffer.from(await res.arrayBuffer()));
    }
    const buffer = Buffer.concat(chunks);

    // Translate
    const translation = await translateSajuPDF(buffer);

    const pdfBuffer =
      reportType === "love"
        ? await generateLovePDF(translation)
        : await generatePDF(translation);

    const filename =
      reportType === "love"
        ? "love-destiny-english.pdf"
        : "saju-analysis-english.pdf";

    // Clean up blob chunks
    try {
      await Promise.all(chunkUrls.map((url) => del(url)));
    } catch { /* best-effort cleanup */ }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    // Clean up on error
    if (chunkUrls.length > 0) {
      try { await Promise.all(chunkUrls.map((url) => del(url))); } catch { /* */ }
    }
    console.error("Translation error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `Translation failed: ${message}` },
      { status: 500 }
    );
  }
}
