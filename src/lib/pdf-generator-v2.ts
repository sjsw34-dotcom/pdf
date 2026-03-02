import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TranslationResult } from "./translator";
import * as fs from "fs";
import * as path from "path";

// ─── Layout ───────────────────────────────────────────────────────────────────
const MARGIN = 22;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 8.5;    // increased for 14pt body
const SECTION_GAP = 16;

// Banner heights
const TOP_BANNER_H = 16;
const BOTTOM_STRIP_H = 8;

// Content page safe bounds
const CONTENT_TOP = TOP_BANNER_H + 14; // below page header
const CONTENT_BOTTOM = PAGE_H - BOTTOM_STRIP_H - 12; // above page footer

// ─── Font sizes ────────────────────────────────────────────────────────────────
const SZ_COVER_TITLE = 24;
const SZ_COVER_SUB = 13;
const SZ_H1 = 19;      // # PART title (page heading)
const SZ_H2 = 16;      // ## chapter headings within content
const SZ_H3 = 14;      // ### sub-chapter headings (bold, same size as body)
const SZ_BODY = 14;    // body text
const SZ_TABLE = 12;   // table cells
const SZ_SMALL = 9;
const SZ_HEADER = 9;

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND_KR = "운명테라피";
const BRAND_EN = "Unmyung Therapy";
const CONSULTANT = "Ksaju Kim";

// ─── Color palette (navy + gold) ──────────────────────────────────────────────
const C_NAVY: [number, number, number] = [26, 28, 72];
const C_GOLD: [number, number, number] = [182, 148, 78];
const C_CREAM: [number, number, number] = [248, 245, 238];
const C_TEXT: [number, number, number] = [28, 28, 28];
const C_MID: [number, number, number] = [100, 100, 100];
const C_LIGHT: [number, number, number] = [170, 170, 170];
const C_WHITE: [number, number, number] = [255, 255, 255];
const C_ALT_ROW: [number, number, number] = [245, 244, 250];

// ─── Font registration ────────────────────────────────────────────────────────
function registerCJKFont(doc: jsPDF): void {
  const fontPath = path.join(process.cwd(), "src/lib/fonts/NotoSansKR-Regular.ttf");
  const fontData = fs.readFileSync(fontPath);
  const base64 = fontData.toString("base64");
  doc.addFileToVFS("NotoSansKR-Regular.ttf", base64);
  doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
  doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "bold");
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function stripMarkdownHeadings(text: string): string {
  return text.replace(/^#{1,4}\s+/gm, "");
}

function setColor(doc: jsPDF, rgb: [number, number, number], target: "text" | "draw" | "fill") {
  if (target === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else if (target === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function centeredText(doc: jsPDF, text: string, y: number): void {
  const w = doc.getTextWidth(text);
  doc.text(text, (PAGE_W - w) / 2, y);
}

// ─── Markdown table parser ─────────────────────────────────────────────────────
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const parseLine = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim().replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1"));
  const headers = parseLine(lines[0]);
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

// ─── Cover page ───────────────────────────────────────────────────────────────
function renderCoverPage(doc: jsPDF, dateStr: string): void {
  // Top banner (navy)
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, 0, PAGE_W, TOP_BANNER_H, "F");

  // Brand name in banner
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(9);
  setColor(doc, C_GOLD, "text");
  doc.text(BRAND_KR, MARGIN, 10.5);

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(8);
  setColor(doc, C_CREAM, "text");
  const enW = doc.getTextWidth(BRAND_EN);
  doc.text(BRAND_EN, PAGE_W - MARGIN - enW, 10.5);

  // ── Main title block ──────────────────────────────────────────────────────
  let y = 70;

  // Thin gold rule above title
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.6);
  doc.line(MARGIN + 15, y, PAGE_W - MARGIN - 15, y);
  y += 10;

  // Title
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_COVER_TITLE);
  setColor(doc, C_NAVY, "text");
  centeredText(doc, "Saju Analysis Report", y);
  y += 11;

  // Subtitle
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_COVER_SUB);
  setColor(doc, C_MID, "text");
  centeredText(doc, "Four Pillars of Destiny · 사주팔자", y);
  y += 9;

  // Thin gold rule below title
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.6);
  doc.line(MARGIN + 15, y, PAGE_W - MARGIN - 15, y);

  // ── Author block (lower third) ────────────────────────────────────────────
  const blockY = 210;

  // Full-width gold rule
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.4);
  doc.line(MARGIN, blockY, PAGE_W - MARGIN, blockY);

  // "Prepared by" label
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_SMALL);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, "Prepared by", blockY + 10);

  // Consultant name
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(16);
  setColor(doc, C_NAVY, "text");
  centeredText(doc, CONSULTANT, blockY + 20);

  // Brand line
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(10);
  setColor(doc, C_GOLD, "text");
  centeredText(doc, `${BRAND_KR}  ·  ${BRAND_EN}`, blockY + 31);

  // Date
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_SMALL);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, dateStr, blockY + 44);

  // Bottom strip (navy)
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, PAGE_H - BOTTOM_STRIP_H, PAGE_W, BOTTOM_STRIP_H, "F");

  // Reset colors
  setColor(doc, C_TEXT, "text");
}

// ─── Page header / footer for content pages ───────────────────────────────────
function renderPageChrome(doc: jsPDF, pageNum: number, totalPages: number): void {
  // Header: thin navy line + brand text
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, 0, PAGE_W, TOP_BANNER_H, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_HEADER);
  setColor(doc, C_GOLD, "text");
  doc.text(BRAND_KR, MARGIN, 10);

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_HEADER);
  setColor(doc, C_CREAM, "text");
  const consultantW = doc.getTextWidth(`· ${CONSULTANT}`);
  doc.text(`· ${CONSULTANT}`, PAGE_W - MARGIN - consultantW, 10);

  // Footer: thin rule + page number
  setColor(doc, C_LIGHT, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - BOTTOM_STRIP_H - 4, PAGE_W - MARGIN, PAGE_H - BOTTOM_STRIP_H - 4);

  const pageText = `${pageNum} / ${totalPages}`;
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_SMALL);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, pageText, PAGE_H - BOTTOM_STRIP_H);

  // Bottom strip
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, PAGE_H - BOTTOM_STRIP_H + 2, PAGE_W, BOTTOM_STRIP_H, "F");

  // Reset
  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
}

// ─── Intro page ───────────────────────────────────────────────────────────────
function renderIntroPage(doc: jsPDF): void {
  let y = CONTENT_TOP + 8;

  // Tagline
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(14);
  setColor(doc, C_NAVY, "text");
  centeredText(doc, "We study destiny.", y);
  y += 9;

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_MID, "text");
  centeredText(doc, `${CONSULTANT} from ${BRAND_EN}`, y);
  y += 7;

  // Gold center rule
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 30, y, PAGE_W - MARGIN - 30, y);
  y += SECTION_GAP;

  y = renderIntroSection(doc, "What is Saju?", [
    "Saju is an analytical method rooted in traditional Eastern philosophy and statistical principles. It interprets an individual's personality and destiny based on the year, month, day, and hour of birth. Saju (四柱) literally means \"Four Pillars,\" each representing the Year (年), Month (月), Day (日), and Hour (時).",
    "",
    "Unlike fortune-telling based on subjective intuition, Saju pursues objective interpretation grounded in statistical data accumulated over centuries and the theory of Yin-Yang and the Five Elements (陰陽五行). Yin and Yang represent the principle of dividing all phenomena into two opposing natures—light and darkness, day and night. The Five Elements consist of Wood (木), Fire (火), Earth (土), Metal (金), and Water (水), and through the way these elements influence one another, our lives are interpreted.",
  ], y);

  y += SECTION_GAP;

  y = renderIntroSection(doc, "What can Saju reveal?", [
    "Saju is not simply a tool for predicting the future. Its true significance lies in helping you better understand yourself by analyzing your personality, strengths and weaknesses, and the flow of your life. You can use it as a reference when making important decisions or to find direction for addressing areas where you may be lacking.",
    "",
    "At Unmyung Therapy, we aim to help you discover your own unique story through Saju and empower you to make better choices. We will walk you through the path of your life in an approachable and friendly way.",
  ], y);

  y += SECTION_GAP + 6;

  // Closing
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(14);
  setColor(doc, C_NAVY, "text");
  centeredText(doc, "Shall we begin your personal Saju story?", y);

  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
}

function renderIntroSection(doc: jsPDF, heading: string, paragraphs: string[], y: number): number {
  // Left gold accent bar
  setColor(doc, C_GOLD, "fill");
  doc.rect(MARGIN, y - 4, 3, 11, "F");

  // Heading
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_NAVY, "text");
  doc.text(heading, MARGIN + 8, y + 4);
  y += 14;

  // Body
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_TEXT, "text");

  for (const para of paragraphs) {
    if (!para) { y += 4; continue; }
    const lines = doc.splitTextToSize(para, CONTENT_W - 8);
    for (const line of lines) {
      if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
      doc.text(line, MARGIN + 8, y);
      y += LINE_H;
    }
    y += 1.5;
  }

  return y;
}

// ─── Section title ─────────────────────────────────────────────────────────────
function renderSectionTitle(doc: jsPDF, title: string, y: number): number {
  // Gold accent bar
  setColor(doc, C_GOLD, "fill");
  doc.rect(MARGIN, y - 4, 3, 13, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H1);
  setColor(doc, C_NAVY, "text");

  const lines = doc.splitTextToSize(title, CONTENT_W - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
    doc.text(line, MARGIN + 8, y + 4);
    y += LINE_H + 3;
  }

  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
  return y + 3;
}

// ─── Inline heading renderers (## and ### within content) ─────────────────────
function renderContentH2(doc: jsPDF, title: string, y: number): number {
  if (y > CONTENT_BOTTOM - 20) { doc.addPage(); y = CONTENT_TOP; }
  y += 4; // breathing room above

  // Small gold accent bar
  setColor(doc, C_GOLD, "fill");
  doc.rect(MARGIN, y - 4, 3, 10, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_NAVY, "text");
  const lines = doc.splitTextToSize(title, CONTENT_W - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
    doc.text(line, MARGIN + 8, y + 3);
    y += LINE_H + 1;
  }

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_TEXT, "text");
  return y + 3;
}

function renderContentH3(doc: jsPDF, title: string, y: number): number {
  if (y > CONTENT_BOTTOM - 14) { doc.addPage(); y = CONTENT_TOP; }
  y += 3;

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H3);
  setColor(doc, C_NAVY, "text");

  // Tiny gold dash prefix
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y - 1, MARGIN + 4, y - 1);

  const lines = doc.splitTextToSize(title, CONTENT_W - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
    doc.text(line, MARGIN + 8, y);
    y += LINE_H;
  }

  doc.setFont("NotoSansKR", "normal");
  setColor(doc, C_TEXT, "text");
  return y + 2;
}

// ─── Content renderer ─────────────────────────────────────────────────────────
function renderContent(doc: jsPDF, content: string, y: number): number {
  doc.setFontSize(SZ_BODY);
  doc.setFont("NotoSansKR", "normal");
  setColor(doc, C_TEXT, "text");

  const allLines = content.split("\n");
  let i = 0;

  while (i < allLines.length) {
    const trimmed = allLines[i].trim();

    if (/^-{3,}$/.test(trimmed)) { i++; y += 3; continue; }

    // ## TABLE OF CONTENTS — isolated on its own page
    if (/^## TABLE OF CONTENTS/i.test(trimmed)) {
      doc.addPage();
      y = CONTENT_TOP;
      y = renderContentH2(doc, trimmed.slice(3).trim(), y);
      i++;
      // Render TOC body until next heading
      while (i < allLines.length) {
        const tocLine = allLines[i].trim();
        if (/^#{1,3} /.test(tocLine)) break;
        if (!tocLine) { y += 4; i++; continue; }
        // Markdown table inside TOC
        if (tocLine.startsWith("|")) {
          const tableLines: string[] = [];
          while (i < allLines.length) {
            const tl = allLines[i].trim();
            if (!tl.startsWith("|")) break;
            tableLines.push(tl);
            i++;
          }
          const table = parseMarkdownTable(tableLines);
          if (table) { y = renderTable(doc, table.headers, table.rows, y); y += 6; }
          continue;
        }
        const cleanToc = tocLine.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1");
        const wrapped = doc.splitTextToSize(cleanToc, CONTENT_W);
        for (const line of wrapped) {
          if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
          doc.text(line, MARGIN, y);
          y += LINE_H;
        }
        y += 1;
        i++;
      }
      // Force new page after TOC
      doc.addPage();
      y = CONTENT_TOP;
      continue;
    }

    // ## Chapter heading within content
    if (/^## [^#]/.test(trimmed)) {
      y = renderContentH2(doc, trimmed.slice(3).trim(), y);
      i++;
      continue;
    }

    // ### Sub-chapter heading within content
    if (/^### /.test(trimmed)) {
      y = renderContentH3(doc, trimmed.slice(4).trim(), y);
      i++;
      continue;
    }

    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < allLines.length) {
        const tl = allLines[i].trim();
        if (!tl.includes("|")) break;
        tableLines.push(tl);
        i++;
      }
      const table = parseMarkdownTable(tableLines);
      if (table) { y = renderTable(doc, table.headers, table.rows, y); y += 6; continue; }
      i -= tableLines.length;
    }

    if (!trimmed) { y += 4; i++; continue; }

    const isBullet = /^[-•*]\s/.test(trimmed);
    const indent = isBullet ? 7 : 0;
    const width = CONTENT_W - indent;
    const cleanText = trimmed.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1");
    const wrappedLines = doc.splitTextToSize(cleanText, width);

    for (const line of wrappedLines) {
      if (y > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
      if (isBullet && line === wrappedLines[0]) {
        setColor(doc, C_GOLD, "text");
        doc.text("•", MARGIN + 2, y);
        setColor(doc, C_TEXT, "text");
        doc.text(line.replace(/^[-•*]\s*/, ""), MARGIN + indent, y);
      } else {
        doc.text(line, MARGIN + indent, y);
      }
      y += LINE_H;
    }

    y += 1.5;
    i++;
  }

  return y;
}

// ─── Table renderer ───────────────────────────────────────────────────────────
function renderTable(doc: jsPDF, headers: string[], rows: string[][], startY: number): number {
  if (startY > CONTENT_BOTTOM - 20) { doc.addPage(); startY = CONTENT_TOP; }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "NotoSansKR",
      fontStyle: "normal",
      fontSize: SZ_TABLE,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [220, 218, 210],
      lineWidth: 0.25,
      overflow: "linebreak",
      textColor: C_TEXT,
      halign: "center",
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: "bold",
      fontSize: SZ_TABLE,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: C_ALT_ROW,
    },
    tableWidth: CONTENT_W,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 30;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generatePDF(translation: TranslationResult): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Hint to PDF viewers to use continuous (single-column scroll) layout.
  // Respected by most desktop viewers; mobile viewers may still show page gaps.
  doc.setDisplayMode("fullwidth", "continuous", "UseOutlines");

  registerCJKFont(doc);
  doc.setFont("NotoSansKR", "normal");

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Page 1: Cover ────────────────────────────────────────────────────────
  renderCoverPage(doc, dateStr);

  // ── Page 2: Introduction ─────────────────────────────────────────────────
  doc.addPage();
  renderIntroPage(doc);

  // ── Pages 3+: Content (each ## section starts on its own page) ───────────
  for (let i = 0; i < translation.sections.length; i++) {
    const section = translation.sections[i];

    // Every H2 section gets a fresh page
    doc.addPage();
    let y = CONTENT_TOP;

    // Title: strip # markers (PART level)
    const cleanTitle = stripMarkdownHeadings(section.title);
    y = renderSectionTitle(doc, cleanTitle, y);
    y += 6;

    // Content: keep ## and ### for in-content heading detection
    y = renderContent(doc, section.content, y);
  }

  // ── Page headers + footers (all non-cover pages) ──────────────────────────
  const totalPages = doc.getNumberOfPages();
  const contentPages = totalPages - 1; // exclude cover

  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    renderPageChrome(doc, p - 1, contentPages);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
