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
const LINE_H = 8.5;
const SECTION_GAP = 16;

// Banner heights
const TOP_BANNER_H = 16;
const BOTTOM_STRIP_H = 8;

// Content page safe bounds
const CONTENT_TOP = TOP_BANNER_H + 14;
const CONTENT_BOTTOM = PAGE_H - BOTTOM_STRIP_H - 12;

// ─── Font sizes ────────────────────────────────────────────────────────────────
const SZ_H1 = 19;
const SZ_H2 = 16;
const SZ_H3 = 14;
const SZ_BODY = 14;
const SZ_TABLE = 12;
const SZ_SMALL = 9;
const SZ_HEADER = 9;

// ─── Brand ────────────────────────────────────────────────────────────────────
const BRAND_KR = "SajuMuse";
const BRAND_EN = "SajuMuse";
const CONSULTANT = "Ksaju Kim";

// ─── Color palette (rose + purple + gold) ────────────────────────────────────
const C_ROSE: [number, number, number] = [168, 50, 80];       // deep rose
const C_ROSE_LIGHT: [number, number, number] = [220, 130, 150]; // soft rose
const C_PURPLE: [number, number, number] = [88, 56, 128];     // deep purple
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const C_PURPLE_LIGHT: [number, number, number] = [180, 160, 210]; // lavender
const C_GOLD: [number, number, number] = [182, 148, 78];
const C_CREAM: [number, number, number] = [255, 248, 250];    // warm pink cream
const C_TEXT: [number, number, number] = [48, 32, 48];        // dark purple-brown
const C_MID: [number, number, number] = [120, 90, 120];
const C_LIGHT: [number, number, number] = [180, 160, 180];
const C_WHITE: [number, number, number] = [255, 255, 255];
const C_ALT_ROW: [number, number, number] = [252, 245, 248];  // faint pink
const C_TABLE_HEAD: [number, number, number] = [108, 60, 120]; // muted purple for table headers

// ─── Background image settings ────────────────────────────────────────────────
const STRIP_W = 40;
const STRIP_PAD = 4;
const BG_COVER_OPACITY = 0.65;

const BG_ASSETS_DIR = path.join(process.cwd(), "public/assets");

// Dynamic text-area layout
let _mL = MARGIN;
let _cW = CONTENT_W;

let _pageBgPainter: (() => void) | null = null;

function addPageWithBg(doc: jsPDF): void {
  doc.addPage();
  if (_pageBgPainter) _pageBgPainter();
}

// ─── Background image helpers ─────────────────────────────────────────────────
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

async function loadAndCompressStripImage(filename: string): Promise<string | null> {
  const filePath = path.join(BG_ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const stripPx = Math.round(STRIP_W * 150 / 25.4);
  let buf = await sharp(filePath)
    .resize(stripPx, 1754, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (buf.length > 400 * 1024)
    buf = await sharp(buf).jpeg({ quality: 65 }).toBuffer();
  return buf.toString("base64");
}

/** Load illustration image scaled to fit within given mm dimensions. */
async function loadIllustration(filename: string, widthMm: number, heightMm: number): Promise<string | null> {
  const filePath = path.join(BG_ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const wPx = Math.round(widthMm * 150 / 25.4);
  const hPx = Math.round(heightMm * 150 / 25.4);
  let buf = await sharp(filePath)
    .resize(wPx, hPx, { fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (buf.length > 500 * 1024)
    buf = await sharp(buf).jpeg({ quality: 65 }).toBuffer();
  return buf.toString("base64");
}

/** Draws the full-page cover background at BG_COVER_OPACITY. */
function drawCoverBackground(doc: jsPDF, imageBase64: string): void {
  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).setGState((doc as any).GState({ opacity: BG_COVER_OPACITY }));
  doc.addImage(`data:image/jpeg;base64,${imageBase64}`, "JPEG", 0, 0, PAGE_W, PAGE_H, "bg-cover-love");
  doc.restoreGraphicsState();
}

/** Draws the decorative side strip on a content page. */
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
  // Background image
  if (bgImage) drawCoverBackground(doc, bgImage);

  // Protection boxes (warm cream, semi-transparent)
  if (bgImage) {
    doc.saveGraphicsState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).setGState((doc as any).GState({ opacity: 0.90 }));
    setColor(doc, C_CREAM, "fill");
    // Title box
    doc.roundedRect(MARGIN + 14, 58, PAGE_W - 2 * (MARGIN + 14), 88, 6, 6, "F");
    // Client box
    doc.roundedRect(MARGIN + 14, 180, PAGE_W - 2 * (MARGIN + 14), 62, 6, 6, "F");
    doc.restoreGraphicsState();
  }

  // Top banner (deep rose)
  setColor(doc, C_ROSE, "fill");
  doc.rect(0, 0, PAGE_W, TOP_BANNER_H, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(9);
  setColor(doc, C_GOLD, "text");
  doc.text(BRAND_KR, MARGIN, 10.5);

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(8);
  setColor(doc, C_WHITE, "text");
  const enW = doc.getTextWidth(BRAND_EN);
  doc.text(BRAND_EN, PAGE_W - MARGIN - enW, 10.5);

  // ── Title block ─────────────────────────────────────────────────────────────
  // Small label
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(12);
  setColor(doc, C_ROSE, "text");
  centeredText(doc, "Love & Compatibility  ·  Four Pillars of Destiny", 70);

  // Rose gold rule under label
  setColor(doc, C_ROSE_LIGHT, "draw");
  doc.setLineWidth(0.5);
  doc.line(MARGIN + 25, 76, PAGE_W - MARGIN - 25, 76);

  // Main title
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(24);
  setColor(doc, C_PURPLE, "text");
  centeredText(doc, "LOVE DESTINY", 94);
  centeredText(doc, "REPORT", 108);

  // Korean subtitle
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(15);
  setColor(doc, C_ROSE, "text");
  centeredText(doc, "연애운 분석서", 124);

  // Heart accent — small decorative hearts around subtitle
  doc.setFontSize(10);
  setColor(doc, C_ROSE_LIGHT, "text");
  const heartY = 124;
  doc.text("\u2665", MARGIN + 30, heartY);
  doc.text("\u2665", PAGE_W - MARGIN - 33, heartY);

  // Rule under title block
  setColor(doc, C_ROSE_LIGHT, "draw");
  doc.setLineWidth(0.6);
  doc.line(MARGIN + 6, 136, PAGE_W - MARGIN - 6, 136);

  // ── Client block ─────────────────────────────────────────────────────────────
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(10);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, "Prepared for", 194);

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(20);
  setColor(doc, C_PURPLE, "text");
  const displayName = clientName || "\u2014";
  centeredText(doc, displayName, 212);

  // Brand line
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(11);
  setColor(doc, C_ROSE, "text");
  centeredText(doc, `${BRAND_KR}  \u00B7  ${BRAND_EN}`, 230);

  // Thin rule under brand
  setColor(doc, C_ROSE_LIGHT, "draw");
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 6, 238, PAGE_W - MARGIN - 6, 238);

  // Bottom strip (deep rose)
  setColor(doc, C_ROSE, "fill");
  doc.rect(0, PAGE_H - BOTTOM_STRIP_H, PAGE_W, BOTTOM_STRIP_H, "F");

  setColor(doc, C_TEXT, "text");
}

// ─── Page header / footer for content pages ───────────────────────────────────
function renderPageChrome(doc: jsPDF, pageNum: number, totalPages: number): void {
  // Header: rose banner
  setColor(doc, C_ROSE, "fill");
  doc.rect(0, 0, PAGE_W, TOP_BANNER_H, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_HEADER);
  setColor(doc, C_GOLD, "text");
  doc.text(BRAND_KR, MARGIN, 10);

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_HEADER);
  setColor(doc, C_WHITE, "text");
  const consultantW = doc.getTextWidth(`\u00B7 ${CONSULTANT}`);
  doc.text(`\u00B7 ${CONSULTANT}`, PAGE_W - MARGIN - consultantW, 10);

  // Footer
  setColor(doc, C_LIGHT, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - BOTTOM_STRIP_H - 4, PAGE_W - MARGIN, PAGE_H - BOTTOM_STRIP_H - 4);

  const pageText = `${pageNum} / ${totalPages}`;
  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_SMALL);
  setColor(doc, C_LIGHT, "text");
  centeredText(doc, pageText, PAGE_H - BOTTOM_STRIP_H);

  // Bottom strip
  setColor(doc, C_ROSE, "fill");
  doc.rect(0, PAGE_H - BOTTOM_STRIP_H + 2, PAGE_W, BOTTOM_STRIP_H, "F");

  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
}

// ─── Intro page ───────────────────────────────────────────────────────────────
function renderIntroPage(doc: jsPDF, introIllustration: string | null): void {
  let y = CONTENT_TOP + 4;

  // Top illustration (love3 — pastel LOVE with heart balloons)
  if (introIllustration) {
    const imgW = 100;
    const imgH = 55;
    const imgX = (PAGE_W - imgW) / 2;
    doc.addImage(`data:image/jpeg;base64,${introIllustration}`, "JPEG", imgX, y, imgW, imgH, "intro-ill");
    y += imgH + 8;
  }

  // Tagline
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(14);
  setColor(doc, C_PURPLE, "text");
  centeredText(doc, "Discover your love story written in the stars.", y);
  y += 9;

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_MID, "text");
  centeredText(doc, `${CONSULTANT} from ${BRAND_EN}`, y);
  y += 7;

  // Rose center rule
  setColor(doc, C_ROSE_LIGHT, "draw");
  doc.setLineWidth(0.5);
  doc.line(_mL + 8, y, PAGE_W - _mL - 8, y);
  y += SECTION_GAP;

  y = renderIntroSection(doc, "What is a Love Destiny Reading?", [
    "Your love destiny reading uses the Four Pillars of your birth chart to reveal your natural romantic tendencies, emotional patterns, and the types of partners who harmonize best with your energy.",
    "",
    "Rather than predicting a single outcome, this analysis illuminates the deeper dynamics at play in your love life \u2014 helping you understand why you are drawn to certain people, what you truly need in a relationship, and when the stars align for meaningful connections.",
  ], y);

  y += SECTION_GAP;

  y = renderIntroSection(doc, "What will you discover?", [
    "This report covers your core romantic personality, ideal partner archetypes based on elemental compatibility, zodiac-based affinities, and practical guidance on timing and direction for finding love.",
    "",
    "Whether you are navigating a new relationship or seeking clarity about your love patterns, this reading offers insight grounded in centuries of Eastern wisdom \u2014 presented in a way that feels personal and actionable.",
  ], y);

  y += SECTION_GAP + 6;

  // Closing
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(14);
  setColor(doc, C_PURPLE, "text");
  centeredText(doc, "Let\u2019s explore the love written in your destiny.", y);

  setColor(doc, C_TEXT, "text");
  doc.setFont("NotoSansKR", "normal");
}

function renderIntroSection(doc: jsPDF, heading: string, paragraphs: string[], y: number): number {
  // Left rose accent bar
  setColor(doc, C_ROSE_LIGHT, "fill");
  doc.rect(_mL, y - 4, 3, 11, "F");

  // Heading
  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_PURPLE, "text");
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
  // Rose accent bar
  setColor(doc, C_ROSE_LIGHT, "fill");
  doc.rect(_mL, y - 4, 3, 13, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H1);
  setColor(doc, C_PURPLE, "text");

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
  y += 4;

  // Small rose accent bar
  setColor(doc, C_ROSE_LIGHT, "fill");
  doc.rect(_mL, y - 4, 3, 10, "F");

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(SZ_H2);
  setColor(doc, C_PURPLE, "text");
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
  setColor(doc, C_PURPLE, "text");

  // Rose dash prefix
  setColor(doc, C_ROSE_LIGHT, "draw");
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

// ─── Illustration inserter ────────────────────────────────────────────────────
function renderIllustration(doc: jsPDF, imageBase64: string, alias: string, y: number, widthMm: number, heightMm: number): number {
  if (y + heightMm + 10 > CONTENT_BOTTOM) {
    addPageWithBg(doc);
    y = CONTENT_TOP;
  }

  y += 6;
  const imgX = (PAGE_W - widthMm) / 2;

  // Soft shadow/glow behind illustration
  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).setGState((doc as any).GState({ opacity: 0.12 }));
  setColor(doc, C_ROSE_LIGHT, "fill");
  doc.roundedRect(imgX - 3, y - 3, widthMm + 6, heightMm + 6, 4, 4, "F");
  doc.restoreGraphicsState();

  doc.addImage(`data:image/jpeg;base64,${imageBase64}`, "JPEG", imgX, y, widthMm, heightMm, alias);
  y += heightMm + 10;
  return y;
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

    // ## TABLE OF CONTENTS
    if (/^## TABLE OF CONTENTS/i.test(trimmed)) {
      addPageWithBg(doc);
      y = CONTENT_TOP;
      y = renderContentH2(doc, trimmed.slice(3).trim(), y);
      i++;
      while (i < allLines.length) {
        const tocLine = allLines[i].trim();
        if (/^#{1,3} /.test(tocLine)) break;
        if (!tocLine) { y += 4; i++; continue; }
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
      addPageWithBg(doc);
      y = CONTENT_TOP;
      continue;
    }

    // ## Chapter heading
    if (/^## [^#]/.test(trimmed)) {
      y = renderContentH2(doc, trimmed.slice(3).trim(), y);
      i++;
      continue;
    }

    // ### Sub-chapter heading
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

    const isBullet = /^[-\u2022*]\s/.test(trimmed);
    let baseX = _mL + 8;
    const bulletIndent = isBullet ? 5 : 0;
    const width = _cW - 8 - bulletIndent;
    const cleanText = trimmed.replace(/\*\*/g, "").replace(/\*([^*]+)\*/g, "$1");
    const wrappedLines = doc.splitTextToSize(cleanText, width);

    for (const line of wrappedLines) {
      if (y > CONTENT_BOTTOM) { addPageWithBg(doc); y = CONTENT_TOP; baseX = _mL + 8; }
      if (isBullet && line === wrappedLines[0]) {
        setColor(doc, C_ROSE, "text");
        doc.text("\u2665", baseX, y);   // heart bullet for love template
        setColor(doc, C_TEXT, "text");
        doc.text(line.replace(/^[-\u2022*]\s*/, ""), baseX + bulletIndent, y);
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
      lineColor: [230, 210, 220],
      lineWidth: 0.25,
      overflow: "linebreak",
      textColor: C_TEXT,
      halign: "center",
    },
    headStyles: {
      fillColor: C_TABLE_HEAD,
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

// ─── Ending page ──────────────────────────────────────────────────────────────
function renderEndingPage(doc: jsPDF, endingIllustration: string | null): void {
  let y = CONTENT_TOP + 20;

  if (endingIllustration) {
    const imgW = 80;
    const imgH = 90;
    const imgX = (PAGE_W - imgW) / 2;
    doc.addImage(`data:image/jpeg;base64,${endingIllustration}`, "JPEG", imgX, y, imgW, imgH, "ending-ill");
    y += imgH + 16;
  }

  doc.setFont("NotoSansKR", "bold");
  doc.setFontSize(18);
  setColor(doc, C_PURPLE, "text");
  centeredText(doc, "Your love story is already being written.", y);
  y += 12;

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(SZ_BODY);
  setColor(doc, C_MID, "text");
  centeredText(doc, "Understanding your heart is the first step to finding it.", y);
  y += 24;

  // Decorative hearts
  doc.setFontSize(14);
  setColor(doc, C_ROSE_LIGHT, "text");
  centeredText(doc, "\u2665  \u2665  \u2665", y);
  y += 16;

  doc.setFont("NotoSansKR", "normal");
  doc.setFontSize(11);
  setColor(doc, C_ROSE, "text");
  centeredText(doc, `${BRAND_KR}  \u00B7  ${BRAND_EN}`, y);

  setColor(doc, C_TEXT, "text");
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateLovePDF(translation: TranslationResult): Promise<Buffer> {
  // Load all images
  const [bgCover, bgStrip1, bgStrip2, introIll, sectionIll, endingIll] = await Promise.all([
    loadAndCompressBgImage("love2.jpg"),         // cover: starry sky with heart
    loadAndCompressStripImage("love1.jpg"),       // strip left: pastel cloud LOVE
    loadAndCompressStripImage("love4.jpg"),       // strip right: peonies bouquet
    loadIllustration("love3.jpg", 100, 55),       // intro: pastel LOVE balloons
    loadIllustration("love5.jpg", 70, 80),        // section: couple illustration
    loadIllustration("love6.jpg", 70, 80),        // ending: couple watercolor
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setDisplayMode("fullwidth", "continuous", "UseOutlines");

  registerCJKFont(doc);
  doc.setFont("NotoSansKR", "normal");

  // ── Page 1: Cover ────────────────────────────────────────────────────────
  renderCoverPage(doc, bgCover, translation.clientName ?? "");

  // ── Pages 2+: Introduction + Content ─────────────────────────────────────
  let nonCoverIdx = 0;

  const setupPage = () => {
    const isEven = nonCoverIdx % 2 === 0;
    const side = isEven ? "left" : "right";
    const bg = isEven ? bgStrip1 : bgStrip2;
    const alias = isEven ? "bg-strip-love-1" : "bg-strip-love-2";

    _mL = isEven ? STRIP_W + STRIP_PAD : MARGIN;
    _cW = PAGE_W - _mL - (isEven ? MARGIN : STRIP_W + STRIP_PAD);

    if (bg) drawImageStrip(doc, bg, alias, side);
    nonCoverIdx++;
  };

  _pageBgPainter = () => {
    doc.setPage(doc.getNumberOfPages());
    setupPage();
  };

  // ── Page 2: Introduction ─────────────────────────────────────────────────
  doc.addPage();
  setupPage();
  renderIntroPage(doc, introIll);

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

  // ── Pages 3+: Content ────────────────────────────────────────────────────
  // Determine midpoint for inserting illustration between sections
  const midIdx = Math.floor(translation.sections.length / 2);

  for (let i = 0; i < translation.sections.length; i++) {
    const section = translation.sections[i];

    doc.addPage();
    setupPage();
    let y = CONTENT_TOP;

    const cleanTitle = stripMarkdownHeadings(section.title);
    y = renderSectionTitle(doc, cleanTitle, y);
    y += 6;

    y = renderContent(doc, section.content, y);

    // Insert couple illustration at midpoint of sections
    if (i === midIdx && sectionIll) {
      y = renderIllustration(doc, sectionIll, "section-ill-love5", y, 70, 80);
    }
  }

  // ── Ending page ──────────────────────────────────────────────────────────
  doc.addPage();
  setupPage();
  renderEndingPage(doc, endingIll);

  _pageBgPainter = null;
  _mL = MARGIN;
  _cW = CONTENT_W;

  // ── Page headers + footers ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  const contentPages = totalPages - 1;

  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    renderPageChrome(doc, p - 1, contentPages);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
