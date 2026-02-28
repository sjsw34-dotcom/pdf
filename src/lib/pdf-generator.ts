import { jsPDF } from "jspdf";
import { TranslationResult } from "./translator";

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const SECTION_GAP = 10;

export function generatePDF(translation: TranslationResult): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let y = MARGIN;

  // Title page
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const title = "Saju (Four Pillars) Analysis";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (PAGE_WIDTH - titleWidth) / 2, 60);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const subtitle = "Translated from Korean";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (PAGE_WIDTH - subtitleWidth) / 2, 72);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const dateStr = `Generated on ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, (PAGE_WIDTH - dateWidth) / 2, 82);
  doc.setTextColor(0, 0, 0);

  // Add a decorative line
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, 90, PAGE_WIDTH - MARGIN - 30, 90);

  // Content pages
  doc.addPage();
  y = MARGIN;

  for (let i = 0; i < translation.sections.length; i++) {
    const section = translation.sections[i];

    // Check if we need a new page for section header
    if (y > PAGE_HEIGHT - 40) {
      doc.addPage();
      y = MARGIN;
    }

    // Section title
    y = renderSectionTitle(doc, section.title, y);
    y += 4;

    // Section content
    y = renderContent(doc, section.content, y);
    y += SECTION_GAP;

    // Add separator between sections (except last)
    if (i < translation.sections.length - 1) {
      if (y > PAGE_HEIGHT - 30) {
        doc.addPage();
        y = MARGIN;
      } else {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(MARGIN + 20, y, PAGE_WIDTH - MARGIN - 20, y);
        y += SECTION_GAP;
      }
    }
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const pageText = `${i - 1} / ${totalPages - 1}`;
    const pageWidth = doc.getTextWidth(pageText);
    doc.text(pageText, (PAGE_WIDTH - pageWidth) / 2, PAGE_HEIGHT - 10);
    doc.setTextColor(0, 0, 0);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function renderSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 80);

  const lines = doc.splitTextToSize(title, CONTENT_WIDTH);
  for (const line of lines) {
    if (y > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT + 2;
  }

  // Underline
  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 2, MARGIN + 50, y - 2);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  return y;
}

function renderContent(doc: jsPDF, content: string, y: number): number {
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");

  const paragraphs = content.split("\n");

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      y += 3;
      continue;
    }

    // Check for bullet points
    const isBullet = /^[-•*]\s/.test(trimmed);
    const indent = isBullet ? 6 : 0;
    const width = CONTENT_WIDTH - indent;

    // Check for bold markers (simple **text** handling)
    const cleanText = trimmed.replace(/\*\*/g, "");

    const lines = doc.splitTextToSize(cleanText, width);

    for (const line of lines) {
      if (y > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }

      if (isBullet && line === lines[0]) {
        doc.text("•", MARGIN + 2, y);
        doc.text(line.replace(/^[-•*]\s*/, ""), MARGIN + indent, y);
      } else {
        doc.text(line, MARGIN + indent, y);
      }

      y += LINE_HEIGHT;
    }

    y += 1; // Extra space between paragraphs
  }

  return y;
}
