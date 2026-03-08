import { NextRequest, NextResponse } from "next/server";
import { translateSajuPDF } from "@/lib/translator";
import { generatePDF } from "@/lib/pdf-generator-v2";
import { generateLovePDF } from "@/lib/pdf-generator-love";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const reportType = (formData.get("type") as string) || "general";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Claude reads the PDF directly — handles text, images, and custom fonts
    const translation = await translateSajuPDF(buffer);

    const pdfBuffer =
      reportType === "love"
        ? await generateLovePDF(translation)
        : await generatePDF(translation);

    const filename =
      reportType === "love"
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
    console.error("Translation error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `Translation failed: ${message}` },
      { status: 500 }
    );
  }
}
