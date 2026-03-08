import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { translateSajuPDF } from "@/lib/translator";
import { generatePDF } from "@/lib/pdf-generator-v2";
import { generateLovePDF } from "@/lib/pdf-generator-love";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let blobUrl: string | null = null;

  try {
    const body = await request.json();
    const { url, type: reportType = "general" } = body as {
      url: string;
      type?: string;
    };

    if (!url) {
      return NextResponse.json({ error: "No file URL provided" }, { status: 400 });
    }

    blobUrl = url;

    // Download PDF from Vercel Blob
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Claude reads the PDF directly
    const translation = await translateSajuPDF(buffer);

    const pdfBuffer =
      reportType === "love"
        ? await generateLovePDF(translation)
        : await generatePDF(translation);

    const filename =
      reportType === "love"
        ? "love-destiny-english.pdf"
        : "saju-analysis-english.pdf";

    // Clean up blob after processing
    try {
      await del(url);
    } catch {
      // Blob cleanup is best-effort
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    // Clean up blob on error too
    if (blobUrl) {
      try { await del(blobUrl); } catch { /* best-effort */ }
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
