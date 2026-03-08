import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import {
  cleanTranslation,
  parseIntoSections,
  extractClientName,
} from "@/lib/translator";
import { generatePDF } from "@/lib/pdf-generator-v2";
import { generateLovePDF } from "@/lib/pdf-generator-love";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      texts,
      type = "general",
      pageChunkUrls = [],
    }: {
      texts: string[];
      type?: "general" | "love";
      pageChunkUrls?: string[];
    } = body;

    if (!texts || texts.length === 0) {
      return NextResponse.json(
        { error: "No translated texts provided" },
        { status: 400 }
      );
    }

    // 1. Combine texts, clean, parse into sections, extract client name
    const combined = texts.join("\n\n");
    const cleaned = cleanTranslation(combined);
    const sections = parseIntoSections(cleaned);
    const clientName = extractClientName(cleaned);

    const translation = { translatedText: cleaned, sections, clientName };

    // 2. Generate PDF using appropriate generator
    const pdfBuffer =
      type === "love"
        ? await generateLovePDF(translation)
        : await generatePDF(translation);

    // 3. Clean up all blob URLs (pageChunkUrls)
    if (pageChunkUrls.length > 0) {
      try {
        await Promise.all(pageChunkUrls.map((url) => del(url)));
      } catch {
        /* best-effort cleanup */
      }
    }

    const filename =
      type === "love"
        ? "love-destiny-english.pdf"
        : "saju-analysis-english.pdf";

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Generate PDF error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `PDF generation failed: ${message}` },
      { status: 500 }
    );
  }
}
