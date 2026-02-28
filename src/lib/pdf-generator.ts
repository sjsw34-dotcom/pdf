import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TranslationResult } from "./translator";
import * as fs from "fs";
import * as path from "path";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 7;
const SECTION_GAP = 12;

// Font sizes
const FONT_TITLE = 26;       // Cover title
const FONT_SUBTITLE = 14;    // Cover subtitle
const FONT_DATE = 12;        // Cover date
const FONT_H1 = 18;          // Section titles (## headings)
const FONT_H2 = 15;          // Intro sub-headings
const FONT_BODY = 12;        // Body text (minimum 12pt)
const FONT_TABLE = 10;       // Table cells (slightly smaller for fit)
const FONT_TABLE_HEAD = 10;  // Table headers
const FONT_PAGE_NUM = 10;    // Page numbers

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
  doc.setFontSize(FONT_TITLE);
  const title = "Saju (Four Pillars) Analysis";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (PAGE_WIDTH - titleWidth) / 2, 60);

  doc.setFontSize(FONT_SUBTITLE);
  const subtitle = "Translated from Korean";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (PAGE_WIDTH - subtitleWidth) / 2, 75);

  doc.setFontSize(FONT_DATE);
  doc.setTextColor(120, 120, 120);
  const dateStr = `Generated on ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, (PAGE_WIDTH - dateWidth) / 2, 88);
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, 96, PAGE_WIDTH - MARGIN - 30, 96);

  // Introduction page
  doc.addPage();
  renderIntroPage(doc);

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
    y += 5;

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
    doc.setFontSize(FONT_PAGE_NUM);
    doc.setTextColor(150, 150, 150);
    const pageText = `${i - 1} / ${totalPages - 1}`;
    const pw = doc.getTextWidth(pageText);
    doc.text(pageText, (PAGE_WIDTH - pw) / 2, PAGE_HEIGHT - 10);
    doc.setTextColor(0, 0, 0);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function renderIntroPage(doc: jsPDF): void {
  let y = 35;

  // Header
  doc.setFontSize(FONT_H2);
  doc.setFont("NotoSansKR", "bold");
  doc.setTextColor(30, 30, 80);
  const header = "We study destiny! I am Ksaju Kim from Destiny Therapy.";
  const headerLines = doc.splitTextToSize(header, CONTENT_WIDTH);
  for (const line of headerLines) {
    const lw = doc.getTextWidth(line);
    doc.text(line, (PAGE_WIDTH - lw) / 2, y);
    y += LINE_HEIGHT + 3;
  }

  // Decorative line
  y += 4;
  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 20, y, PAGE_WIDTH - MARGIN - 20, y);
  y += SECTION_GAP;

  // "What is Saju?" heading
  doc.setFontSize(FONT_H1);
  doc.setFont("NotoSansKR", "bold");
  doc.setTextColor(30, 30, 80);
  const q1 = "What is Saju?";
  const q1w = doc.getTextWidth(q1);
  doc.text(q1, (PAGE_WIDTH - q1w) / 2, y);
  y += LINE_HEIGHT + 3;
  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  const q1uw = doc.getTextWidth(q1);
  doc.line((PAGE_WIDTH - q1uw) / 2, y - 2, (PAGE_WIDTH + q1uw) / 2, y - 2);
  y += 5;

  y = renderIntroBody(doc, [
    "Saju is an analytical method rooted in traditional Eastern philosophy and statistical principles. It interprets an individual's personality and destiny based on the year, month, day, and hour of birth. Saju (\u56DB\u67F1) literally means \"Four Pillars,\" each representing the Year (\u5E74), Month (\u6708), Day (\u65E5), and Hour (\u6642).",
    "",
    "Unlike fortune-telling based on subjective intuition, Saju pursues objective interpretation grounded in statistical data accumulated over centuries and the theory of Yin-Yang and the Five Elements (\u9670\u967D\u4E94\u884C). Yin and Yang represent the principle of dividing all phenomena into two opposing natures\u2014light and darkness, day and night. The Five Elements consist of Wood (\u6728), Fire (\u706B), Earth (\u571F), Metal (\u91D1), and Water (\u6C34), and through the way these elements influence one another, our lives are interpreted.",
  ], y);

  y += SECTION_GAP;

  // "What can Saju reveal?" heading
  doc.setFontSize(FONT_H1);
  doc.setFont("NotoSansKR", "bold");
  doc.setTextColor(30, 30, 80);
  const q2 = "What can Saju reveal?";
  const q2w = doc.getTextWidth(q2);
  doc.text(q2, (PAGE_WIDTH - q2w) / 2, y);
  y += LINE_HEIGHT + 3;
  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  const q2uw = doc.getTextWidth(q2);
  doc.line((PAGE_WIDTH - q2uw) / 2, y - 2, (PAGE_WIDTH + q2uw) / 2, y - 2);
  y += 5;

  y = renderIntroBody(doc, [
    "Saju is not simply a tool for predicting the future. Its true significance lies in helping you better understand yourself by analyzing your personality, strengths and weaknesses, and the flow of your life. For example, you can use it as a reference when making important decisions or to find direction for addressing areas where you may be lacking.",
    "",
    "At Destiny Therapy, we aim to help you discover your own unique story through Saju and empower you to make better choices. If Saju analysis has ever felt difficult or rigid, don't worry\u2014we will walk you through the path of your life in an approachable and friendly way.",
  ], y);

  y += SECTION_GAP + 4;

  // Closing
  doc.setFontSize(FONT_H2);
  doc.setFont("NotoSansKR", "bold");
  doc.setTextColor(30, 30, 80);
  const closing = "Shall we begin your personal Saju story?";
  const cw = doc.getTextWidth(closing);
  doc.text(closing, (PAGE_WIDTH - cw) / 2, y);

  // Bottom decorative line
  y += 10;
  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 20, y, PAGE_WIDTH - MARGIN - 20, y);

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setFont("NotoSansKR", "normal");
}

/** Render intro body paragraphs with the same line spacing as renderContent */
function renderIntroBody(doc: jsPDF, paragraphs: string[], y: number): number {
  doc.setFontSize(FONT_BODY);
  doc.setFont("NotoSansKR", "normal");
  doc.setTextColor(50, 50, 50);

  for (const para of paragraphs) {
    if (!para) {
      y += 4;
      continue;
    }
    const lines = doc.splitTextToSize(para, CONTENT_WIDTH);
    for (const line of lines) {
      if (y > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += 1.5;
  }

  return y;
}

function renderSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(FONT_H1);
  doc.setFont("NotoSansKR", "bold");
  doc.setTextColor(30, 30, 80);

  const lines = doc.splitTextToSize(title, CONTENT_WIDTH);
  for (const line of lines) {
    if (y > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT + 3;
  }

  doc.setDrawColor(30, 30, 80);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 2, MARGIN + 60, y - 2);

  doc.setTextColor(0, 0, 0);
  doc.setFont("NotoSansKR", "normal");

  return y;
}

function renderContent(doc: jsPDF, content: string, y: number): number {
  doc.setFontSize(FONT_BODY);
  doc.setFont("NotoSansKR", "normal");

  const allLines = content.split("\n");
  let i = 0;

  while (i < allLines.length) {
    const trimmed = allLines[i].trim();

    // Skip horizontal rules
    if (/^-{3,}$/.test(trimmed)) {
      i++;
      y += 3;
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
        y += 5;
        continue;
      }
      // If parsing failed, fall through and render as text
      i -= tableLines.length;
    }

    // Empty line
    if (!trimmed) {
      y += 4;
      i++;
      continue;
    }

    const isBullet = /^[-\u2022*]\s/.test(trimmed);
    const indent = isBullet ? 6 : 0;
    const width = CONTENT_WIDTH - indent;

    // Strip bold/italic markers
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

    y += 1.5;
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
      fontSize: FONT_TABLE,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [40, 40, 90],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: FONT_TABLE_HEAD,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    tableWidth: CONTENT_WIDTH,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 30;
}
