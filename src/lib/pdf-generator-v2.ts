import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TranslationResult } from "./translator";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

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
const SZ_H1 = 19;      // # PART title (page heading)
const SZ_H2 = 16;      // ## chapter headings within content
const SZ_H3 = 14;      // ### sub-chapter headings (bold, same size as body)
const SZ_BODY = 14;    // body text
const SZ_TABLE = 12;   // table cells
const SZ_SMALL = 9;
const SZ_HEADER = 9;

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND_KR = "SajuMuse";
const BRAND_EN = "SajuMuse";
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

// ─── Background image settings ────────────────────────────────────────────────
const STRIP_W   = 40;   // mm — side strip width on content pages (≈ 1/5 of page)
const STRIP_PAD = 4;    // mm — gap between strip edge and text area
const BG_COVER_OPACITY = 0.70; // cover background image opacity (0–1)

const BG_ASSETS_DIR = path.join(process.cwd(), "public/assets");

// Dynamic text-area layout — updated before each non-cover page is rendered.
// Content functions use these instead of the fixed MARGIN / CONTENT_W constants.
let _mL = MARGIN;      // effective left text margin for the current page
let _cW = CONTENT_W;   // effective text content width for the current page

// Called automatically whenever a new page is added inside rendering functions.
// Set by generatePDF so overflow pages also receive the correct strip.
let _pageBgPainter: (() => void) | null = null;

function addPageWithBg(doc: jsPDF): void {
  doc.addPage();
  if (_pageBgPainter) _pageBgPainter();
}

// ─── Background image helpers ─────────────────────────────────────────────────
/** Full A4 at 150 dpi (1240 × 1754 px) — used for the cover page. */
async function loadAndCompressBgImage(filename: string): Promise<string | null> {
  const filePath = path.join(BG_ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  let buf = await sharp(filePath)
    .resize(1240, 1754, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (buf.length > 1024 * 1024)
    buf = await sharp(buf).jpeg({ quality: 60 }).toBuffer();
  return buf.toString("base64");
}

/**
 * Crops and resizes image to strip dimensions at 150 dpi (STRIP_W mm × A4 height).
 * Takes the centre column of the source image so the most relevant part shows.
 */
async function loadAndCompressStripImage(filename: string): Promise<string | null> {
  const filePath = path.join(BG_ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const stripPx = Math.round(STRIP_W * 150 / 25.4); // ≈ 236 px wide
  let buf = await sharp(filePath)
    .resize(stripPx, 1754, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (buf.length > 400 * 1024)
    buf = await sharp(buf).jpeg({ quality: 65 }).toBuffer();
  return buf.toString("base64");
}

/** Draws the full-page cover background at BG_COVER_OPACITY. */
function drawCoverBackground(doc: jsPDF, imageBase64: string): void {
  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).setGState((doc as any).GState({ opacity: BG_COVER_OPACITY }));
  doc.addImage(`data:image/jpeg;base64,${imageBase64}`, "JPEG", 0, 0, PAGE_W, PAGE_H, "bg-cover");
  doc.restoreGraphicsState();
}

/** Draws the decorative side strip on a content page (fully opaque). */
function drawImageStrip(doc: jsPDF, imageBase64: string, alias: string, side: "left" | "right"): void {
  const x = side === "left" ? 0 : PAGE_W - STRIP_W;
  doc.addImage(`data:image/jpeg;base64,${imageBase64}`, "JPEG", x, 0, STRIP_W, PAGE_H, alias);
}

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
function renderCoverPage(doc: jsPDF, bgImage: string | null, clientName: string): void {
  // ── Background image ────────────────────────────────────────────────────────
  if (bgImage) drawCoverBackground(doc, bgImage);

  // ── Protection boxes (cream, semi-transparent) ─────────────────────────────
  if (bgImage) {
    doc.saveGraphicsState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setGState((doc as any).GState({ opacity: 0.88 }));
    setColor(doc, C_CREAM, "fill");
    // Title box: y=64–140  (narrower, tighter)
    doc.roundedRect(MARGIN + 18, 64, PAGE_W - 2 * (MARGIN + 18), 76, 4, 4, "F");
    // Client box: y=184–242  (narrower, tighter)
    doc.roundedRect(MARGIN + 18, 184, PAGE_W - 2 * (MARGIN + 18), 58, 4, 4, "F");
    doc.restoreGraphicsState();
  }

  // ── Top banner (navy) ───────────────────────────────────────────────────────
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, 0, PAGE_W, TOP_BANNER_H, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(9);
  setColor(doc, C_GOLD, "text");
  doc.text(BRAND_KR, MARGIN, 10.5);

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(8);
  setColor(doc, C_CREAM, "text");
  const enW = doc.getTextWidth(BRAND_EN);
  doc.text(BRAND_EN, PAGE_W - MARGIN - enW, 10.5);

  // ── Title block ─────────────────────────────────────────────────────────────
  // Small label: 사주팔자 · Four Pillars of Destiny
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(12);
  setColor(doc, C_GOLD, "text");
  centeredText(doc, "사주팔자  ·  Four Pillars of Destiny", 74);

  // Narrow gold rule under label
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 25, 80, PAGE_W - MARGIN - 25, 80);

  // Main title: DESTINY ANALYSIS REPORT (24pt, two lines)
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(24);
  setColor(doc, C_NAVY, "text");
  centeredText(doc, "DESTINY ANALYSIS", 98);
  centeredText(doc, "REPORT", 110);

  // Korean subtitle
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(15);
  setColor(doc, C_GOLD, "text");
  centeredText(doc, "운명 분석서", 126);

  // Full-width gold rule under title block
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.6);
  doc.line(MARGIN + 6, 136, PAGE_W - MARGIN - 6, 136);

  // ── Client block ─────────────────────────────────────────────────────────────
  // "Prepared for" label
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(10);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, "Prepared for", 196);

  // Client name (20pt)
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(20);
  setColor(doc, C_NAVY, "text");
  const displayName = clientName || "—";
  centeredText(doc, displayName, 214);

  // Brand line
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(11);
  setColor(doc, C_GOLD, "text");
  centeredText(doc, `${BRAND_KR}  ·  ${BRAND_EN}`, 232);

  // Thin gold rule under brand
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 6, 240, PAGE_W - MARGIN - 6, 240);

  // ── Bottom strip (navy) ─────────────────────────────────────────────────────
  setColor(doc, C_NAVY, "fill");
  doc.rect(0, PAGE_H - BOTTOM_STRIP_H, PAGE_W, BOTTOM_STRIP_H, "F");

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
  doc.line(_mL + 8, y, PAGE_W - _mL - 8, y);
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
    "At SajuMuse, we aim to help you discover your own unique story through Saju and empower you to make better choices. We will walk you through the path of your life in an approachable and friendly way.",
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
  doc.rect(_mL, y - 4, 3, 11, "F");

  // Heading
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_NAVY, "text");
  doc.text(heading, _mL + 8, y + 4);
  y += 14;

  // Body
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_TEXT, "text");

  for (const para of paragraphs) {
    if (!para) { y += 4; continue; }
    const lines = doc.splitTextToSize(para, _cW - 8);
    for (const line of lines) {
      if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; }
      doc.text(line, _mL + 8, y);
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
  doc.rect(_mL, y - 4, 3, 13, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H1);
  setColor(doc, C_NAVY, "text");

  const lines = doc.splitTextToSize(title, _cW - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; }
    doc.text(line, _mL + 8, y + 4);
    y += LINE_H + 3;
  }

  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
  return y + 3;
}

// ─── Inline heading renderers (## and ### within content) ─────────────────────
function renderContentH2(doc: jsPDF, title: string, y: number): number {
  if (y > CONTENT_BOTTOM - 20) { addPageWithBg(doc); y = CONTENT_TOP; }
  y += 4; // breathing room above

  // Small gold accent bar
  setColor(doc, C_GOLD, "fill");
  doc.rect(_mL, y - 4, 3, 10, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_NAVY, "text");
  const lines = doc.splitTextToSize(title, _cW - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; }
    doc.text(line, _mL + 8, y + 3);
    y += LINE_H + 1;
  }

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_TEXT, "text");
  return y + 3;
}

function renderContentH3(doc: jsPDF, title: string, y: number): number {
  if (y > CONTENT_BOTTOM - 14) { addPageWithBg(doc); y = CONTENT_TOP; }
  y += 3;

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H3);
  setColor(doc, C_NAVY, "text");

  // Tiny gold dash prefix
  setColor(doc, C_GOLD, "draw");
  doc.setLineWidth(1.2);
  doc.line(_mL, y - 1, _mL + 4, y - 1);

  const lines = doc.splitTextToSize(title, _cW - 8);
  for (const line of lines) {
    if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; }
    doc.text(line, _mL + 8, y);
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
      addPageWithBg(doc);
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
        const wrapped = doc.splitTextToSize(cleanToc, _cW - 8);
        for (const line of wrapped) {
          if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; }
          doc.text(line, _mL + 8, y);
          y += LINE_H;
        }
        y += 1;
        i++;
      }
      // Force new page after TOC
      addPageWithBg(doc);
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
    let baseX = _mL + 8;
    const bulletIndent = isBullet ? 5 : 0;
    const width = _cW - 8 - bulletIndent;
    const cleanText = trimmed.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1");
    const wrappedLines = doc.splitTextToSize(cleanText, width);

    for (const line of wrappedLines) {
      if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; baseX = _mL + 8; }
      if (isBullet && line === wrappedLines[0]) {
        setColor(doc, C_GOLD, "text");
        doc.text("•", baseX, y);
        setColor(doc, C_TEXT, "text");
        doc.text(line.replace(/^[-•*]\s*/, ""), baseX + bulletIndent, y);
      } else {
        doc.text(line, baseX + (isBullet ? bulletIndent : 0), y);
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
  if (startY > CONTENT_BOTTOM - 20) { addPageWithBg(doc); startY = CONTENT_TOP; }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows,
    margin: { left: _mL, right: PAGE_W - _mL - _cW },
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
    tableWidth: _cW,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 30;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generatePDF(translation: TranslationResult): Promise<Buffer> {
  // ── Load images (null if file not present — falls back to no image) ───────
  // bgCover: full A4 background for cover page
  // bgStrip1 / bgStrip2: cropped to strip dimensions, alternate left / right
  const [bgCover, bgStrip1, bgStrip2] = await Promise.all([
    loadAndCompressBgImage("bg-cover.jpg"),
    loadAndCompressStripImage("bg-1.jpg"),
    loadAndCompressStripImage("bg-2.jpg"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Hint to PDF viewers to use continuous (single-column scroll) layout.
  // Respected by most desktop viewers; mobile viewers may still show page gaps.
  doc.setDisplayMode("fullwidth", "continuous", "UseOutlines");

  registerCJKFont(doc);
  doc.setFont("NotoSansKR", "normal");

  // ── Page 1: Cover ────────────────────────────────────────────────────────
  renderCoverPage(doc, bgCover, translation.clientName ?? "");

  // ── Pages 2+: Introduction + Content ─────────────────────────────────────
  // Pattern per non-cover page:
  //   even nonCoverIdx (0, 2, 4…) → bg-1 strip on the LEFT
  //   odd  nonCoverIdx (1, 3, 5…) → bg-2 strip on the RIGHT
  let nonCoverIdx = 0;

  const setupPage = () => {
    const isEven = nonCoverIdx % 2 === 0;
    const side   = isEven ? "left" : "right";
    const bg     = isEven ? bgStrip1 : bgStrip2;
    const alias  = isEven ? "bg-strip-1" : "bg-strip-2";

    // Dynamic text margins: widen the margin on the strip side
    _mL = isEven ? STRIP_W + STRIP_PAD : MARGIN;
    _cW = PAGE_W - _mL - (isEven ? MARGIN : STRIP_W + STRIP_PAD);

    if (bg) drawImageStrip(doc, bg, alias, side);
    nonCoverIdx++;
  };

  // Wire up _pageBgPainter so overflow pages also get the correct strip.
  _pageBgPainter = () => {
    doc.setPage(doc.getNumberOfPages()); // ensure we're on the new page
    setupPage();
  };

  // ── Page 2: Introduction ─────────────────────────────────────────────────
  doc.addPage();
  setupPage();
  renderIntroPage(doc);

  // ── Custom text page (inserted right after intro, before content) ──────
  if (translation.customText && translation.customText.trim()) {
    doc.addPage();
    setupPage();
    let cy = CONTENT_TOP;
    cy = renderContentH2(doc, "Additional Notes", cy);
    cy += 2;
    doc.setFont("NotoSansKR", "normal");
    doc.setFontSize(SZ_BODY);
    setColor(doc, C_TEXT, "text");
    const customLines = translation.customText.trim().split("\n");
    for (const cl of customLines) {
      const trimCl = cl.trim();
      if (!trimCl) { cy += 4; continue; }
      const wrapped = doc.splitTextToSize(trimCl, _cW - 8);
      for (const line of wrapped) {
        if (cy > CONTENT_BOTTOM) { addPageWithBg(doc); cy = CONTENT_TOP; }
        doc.text(line, _mL + 8, cy);
        cy += LINE_H;
      }
      cy += 1.5;
    }
  }

  // ── Pages 3+: Content (each section starts on its own page) ──────────────
  for (let i = 0; i < translation.sections.length; i++) {
    const section = translation.sections[i];

    doc.addPage();
    setupPage();
    let y = CONTENT_TOP;

    const cleanTitle = stripMarkdownHeadings(section.title);
    y = renderSectionTitle(doc, cleanTitle, y);
    y += 6;

    // Overflow pages inside renderContent are handled via _pageBgPainter.
    y = renderContent(doc, section.content, y);
  }

  _pageBgPainter = null;
  // Reset to default margins so nothing leaks into subsequent calls
  _mL = MARGIN;
  _cW = CONTENT_W;

  // ── Page headers + footers (all non-cover pages) ──────────────────────────
  const totalPages = doc.getNumberOfPages();
  const contentPages = totalPages - 1; // exclude cover

  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    renderPageChrome(doc, p - 1, contentPages);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
