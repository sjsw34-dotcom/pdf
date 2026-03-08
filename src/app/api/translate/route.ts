import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { translateSajuPDF } from "@/lib/translator";
import { generatePDF } from "@/lib/pdf-generator-v2";
import { generateLovePDF } from "@/lib/pdf-generator-love";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let chunkUrls: string[] = [];

  try {
    const contentType = request.headers.get("content-type") || "";
    let buffer: Buffer;
    let reportType = "general";

    if (contentType.includes("multipart/form-data")) {
      // ── Direct upload (small files < 4MB) ──────────────────────────
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      reportType = (formData.get("type") as string) || "general";

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      // ── Chunked upload (large files via Vercel Blob) ───────────────
      const body = await request.json();
      chunkUrls = body.chunkUrls || [];
      reportType = body.type || "general";

      if (chunkUrls.length === 0) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const token = process.env.BLOB_READ_WRITE_TOKEN || "";
      const chunks: Buffer[] = [];
      for (const url of chunkUrls) {
        // Private blob: use token query param for download
        const separator = url.includes("?") ? "&" : "?";
        const downloadUrl = `${url}${separator}token=${token}`;
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`Failed to download chunk: ${res.status}`);
        chunks.push(Buffer.from(await res.arrayBuffer()));
      }
      buffer = Buffer.concat(chunks);
    }

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

    // Clean up blob chunks if any
    if (chunkUrls.length > 0) {
      try { await Promise.all(chunkUrls.map((url) => del(url))); } catch { /* */ }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
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
