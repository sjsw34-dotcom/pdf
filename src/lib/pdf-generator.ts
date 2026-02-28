import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TranslationResult } from "./translator";
import * as fs from "fs";
import * as path from "path";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const SECTION_GAP = 10;

function registerCJKFont(doc: jsPDF): void {
  const fontPath = path.join(process.cwd(), "src/lib/fonts/NotoSansKR-Regular.ttf");
  const fontData = fs.readFileSync(fontPath);
  const base64 = fontData.toString("base64");

  doc.addFileToVFS("NotoSansKR-Regular.ttf", base64);
  doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
  doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "bold");
}

/** Strip markdown heading markers: # Title → Title */
function stripMarkdownHeadings(text: string): string {
  return text.replace(/^#{1,4}\s+/gm, "");
}

/** Parse markdown table lines into header + rows */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const parseLine = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim().replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1"));

  const headers = parseLine(lines[0]);

  // Skip separator line (|---|---|...)
  const startIdx = /^\|?\s*[-:]+/.test(lines[1]) ? 2 : 1;

  const rows: string[][] = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (!lines[i].includes("|")) break;
    rows.push(parseLine(lines[i]));
  }

  if (rows.length === 0 && startIdx === 2) return { headers, rows: [] };
  if (rows.length === 0) return null;
  return { headers, rows };
}

export function generatePDF(translation: TranslationResult): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  registerCJKFont(doc);
  doc.setFont("NotoSansKR", "normal");

  // Title page
  doc.setFontSize(22);
  const title = "Saju (Four Pillars) Analysis";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (PAGE_WIDTH - titleWidth) / 2, 60);

  doc.setFontSize(12);
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

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, 90, PAGE_WIDTH - MARGIN - 30, 90);

  // Content pages
  doc.addPage();
  let y = MARGIN;

  for (let i = 0; i < translation.sections.length; i++) {
    const section = translation.sections[i];

    if (y > PAGE_HEIGHT - 40) {
      doc.addPage();
      y = MARGIN;
    }

    // Section title (strip # markers)
    const cleanTitle = stripMarkdownHeadings(section.title);
    y = renderSectionTitle(doc, cleanTitle, y);
    y += 4;

    // Section content (strip # markers, render tables)
    const cleanContent = stripMarkdownHeadings(section.content);
    y = renderContent(doc, cleanContent, y);
    y += SECTION_GAP;

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

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const pageText = `${i - 1} / ${totalPages - 1}`;
    const pw = doc.getTextWidth(pageText);
    doc.text(pageText, (PAGE_WIDTH - pw) / 2, PAGE_HEIGHT - 10);
    doc.setTextColor(0, 0, 0);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function renderSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont("NotoSansKR", "bold");
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

  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 2, MARGIN + 50, y - 2);

  doc.setTextColor(0, 0, 0);
  doc.setFont("NotoSansKR", "normal");

  return y;
}

function renderContent(doc: jsPDF, content: string, y: number): number {
  doc.setFontSize(10.5);
  doc.setFont("NotoSansKR", "normal");

  const allLines = content.split("\n");
  let i = 0;

  while (i < allLines.length) {
    const trimmed = allLines[i].trim();

    // Skip horizontal rules
    if (/^-{3,}$/.test(trimmed)) {
      i++;
      y += 2;
      continue;
    }

    // Detect markdown table block
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < allLines.length) {
        const tl = allLines[i].trim();
        if (!tl.includes("|")) break;
        tableLines.push(tl);
        i++;
      }

      const table = parseMarkdownTable(tableLines);
      if (table) {
        y = renderTable(doc, table.headers, table.rows, y);
        y += 4;
        continue;
      }
      // If parsing failed, fall through and render as text
      i -= tableLines.length;
    }

    // Empty line
    if (!trimmed) {
      y += 3;
      i++;
      continue;
    }

    // Subsection heading (bold line without # prefix — already stripped)
    // Check for lines that are short and look like titles
    const isBullet = /^[-\u2022*]\s/.test(trimmed);
    const indent = isBullet ? 6 : 0;
    const width = CONTENT_WIDTH - indent;

    // Strip bold markers
    const cleanText = trimmed.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1");

    const wrappedLines = doc.splitTextToSize(cleanText, width);

    for (const line of wrappedLines) {
      if (y > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }

      if (isBullet && line === wrappedLines[0]) {
        doc.text("\u2022", MARGIN + 2, y);
        doc.text(line.replace(/^[-\u2022*]\s*/, ""), MARGIN + indent, y);
      } else {
        doc.text(line, MARGIN + indent, y);
      }

      y += LINE_HEIGHT;
    }

    y += 1;
    i++;
  }

  return y;
}

function renderTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  startY: number
): number {
  // Check if we need a new page
  if (startY > PAGE_HEIGHT - 50) {
    doc.addPage();
    startY = MARGIN;
  }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "NotoSansKR",
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [40, 40, 90],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    tableWidth: CONTENT_WIDTH,
  });

  // Get the Y position after the table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 30;
}
