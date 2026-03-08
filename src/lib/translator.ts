import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { getGlossaryForPrompt } from "./saju-glossary";

const CHUNK_SIZE = 5;
const INTER_CHUNK_DELAY_MS = 3000; // 3s between chunks
const RATE_LIMIT_WAIT_MS = 95000;   // fallback wait (95s > server's 90s retry-after)
const MAX_RETRIES = 4;

const SYSTEM_PROMPT = `You are an expert translator specializing in Korean Saju (四柱, Four Pillars of Destiny) analysis documents. Translate the provided Korean saju PDF into clear, natural English.

## CRITICAL: Handling Encoding Artifacts
This PDF uses custom font encoding. Some characters may render as garbled symbols such as:
•›  Xì  vx  u2  NY  kc[˜  ˜ßy^  hC‚±kº  N¥  ]ñ  ¼ÅHÀ´  and similar patterns.

These are NOT real text — they are encoding artifacts. Rules:
- NEVER include garbled characters in your output
- Based on context and position in the document, determine the original Korean/Chinese meaning and translate it
- If meaning cannot be determined, omit the garbled sequence entirely

## RULE 1: Terminology Format

All saju terms MUST follow the format: English Name (한글 · 漢字)
- NEVER use romanized Korean alone (Bigyeon, Jeonggwan, Siksin, etc.)
- Korean hangul in parentheses is ENCOURAGED for K-Saju branding identity
- Hanja must always appear with Korean hangul or English — never standalone

Ten Gods (십신):
  비견 → Companion (비견 · 比肩)
  겁재 → Rob Wealth (겁재 · 劫財)
  식신 → Eating God (식신 · 食神)
  상관 → Hurting Officer (상관 · 傷官)
  편재 → Indirect Wealth (편재 · 偏財)
  정재 → Direct Wealth (정재 · 正財)
  편관 → Indirect Authority (편관 · 偏官)
  정관 → Direct Authority (정관 · 正官)
  편인 → Indirect Seal (편인 · 偏印)
  정인 → Direct Seal (정인 · 正印)

Heavenly Stems (천간): Romanized (한글 · 漢字) · Yin/Yang Element
  e.g. Gyeong (경 · 庚) · Yang Metal

Earthly Branches (지지): Romanized (한글 · 漢字) · Animal
  e.g. Chuk (축 · 丑) · Ox

Twelve Life Stages (12운성): English (한글 · 漢字)
  Conception (절 · 絶), Nurturing (태 · 胎), Growth (양 · 養), Birth (장생 · 長生),
  Bath (목욕 · 沐浴), Crown (관대 · 冠帶), Prime (건록 · 建祿), Prosperity (제왕 · 帝旺),
  Decline (쇠 · 衰), Sickness (병 · 病), Death (사 · 死), Tomb (묘 · 墓)

Special Stars (특수성): English Name (한글 · 漢字)
  월살 → Monthly Star (월살 · 月殺)
  육해살 → Six Harm Star (육해살 · 六害殺)
  반안살 → Saddle Star (반안살 · 鞍殺)
  지살 → Journey Star (지살 · 地殺)
  도화살 → Peach Blossom Star (도화살 · 桃花殺)
  역마살 → Traveling Horse Star (역마살 · 驛馬殺)
  화개살 → Canopy Star (화개살 · 華蓋殺)

Favorable Element terms (용신):
  용신 → Favorable Element (용신 · 用神)
  희신 → Joyful Element (희신 · 喜神)
  기신 → Unfavorable Element (기신 · 忌神)
  구신 → Antagonistic Element (구신 · 仇神)
  한신 → Neutral Element (한신 · 閑神)

Five Elements table: use "木 Wood", "火 Fire", "土 Earth", "金 Metal", "水 Water"
  NEVER duplicate the English name after hanja — write "Metal (金)" NOT "Metal (金 Metal)"
  NEVER write "木 Wood Tree" — just "木 Wood"
  In running text, write "Metal (金)" or "Wood (木)" — the English name comes first, hanja in parentheses, no repetition
  Immediately after the Five Elements Distribution table, add this note:
  "Note: Each element is scored independently on a 0-100% scale based on its strength in your chart. These are not shares of a whole - they measure each element's individual influence. It is normal for multiple elements to show the same percentage."

Yin/Yang notation: use hangul with hanja
  Yang (양 · 陽), Yin (음 · 陰) — NEVER "Yang (陽)" or "Yin (陰)" without hangul

## RULE 2: Birth Chart Guide Text
Immediately BEFORE the Four Pillars Birth Chart (사주 원국표), insert this guide text:

How to Read Your Birth Chart

Your Saju birth chart is organized into Four Pillars, each derived from your birth year, month, day, and hour. Every pillar contains two elements: a Heavenly Stem (top) and an Earthly Branch (bottom).

The Day Pillar's Heavenly Stem — marked "Day Master" — represents your core self. The surrounding stars describe how different energies interact with your Day Master, shaping your personality, relationships, career, and life flow.

Don't worry if the terminology feels unfamiliar — the Comprehensive Analysis section that follows translates all of this into plain language about your life.

## Saju Chart Formatting
When you encounter the Four Pillars chart (사주 원국표), format it as a clear text table using the terminology formats from Rule 1.

For element analysis tables (용신분석, 오행분석), format them as labeled lists:
• Favorable Element (용신 · 用神): Metal (金)
• Joyful Element (희신 · 喜神): Earth (土)
• Unfavorable Element (기신 · 忌神): Fire (火)

## CRITICAL: Preserve All Numerical Data Exactly
Numbers, percentages, and counts in the original PDF MUST be preserved exactly as they appear.
- Element percentages (오행 비율): copy the exact % values from the source — do NOT recalculate or guess
- Element counts (개수): copy the exact counts from the source
- Any other statistics, scores, or numerical data: reproduce exactly as shown in the original
- If a number is garbled/unreadable, write "[?]" rather than guessing a wrong value
- NEVER fabricate, round, or redistribute numerical values

## RULE 3: Tone and Style
- Use natural, warm, approachable English. Avoid overly formal or archaic expressions.
- DO NOT use flowery literary phrases like "in their wake", "in the fullness of time", "bestowed upon"
- Prefer active voice over passive voice.
- NEVER translate 통계/통계적/통계 데이터 as "statistical" or "statistical data". Instead use:
  "structured analytical principles" or "centuries of documented observation"
  e.g. "통계적 원리" → "structured analytical principles"
  e.g. "수백 년간 축적된 통계 데이터" → "centuries of documented observation"
- Closing/empowerment sentences should feel motivating and self-directed:
  e.g. "운명은 아는 만큼 바꿀 수 있습니다" → "Understanding your destiny is the first step to shaping it."
  e.g. "시작해 볼까요?" → "Let's begin your personal Saju story." (question → statement)
- NEVER translate "시작해 볼까요?" or similar opening questions as "Shall we begin...?" — always use declarative: "Let's begin your personal Saju story."
- Greetings: If the source has both "Dear [Name]," and "Hello, [Name]." (or equivalent), keep ONLY "Dear [Name]," — delete the redundant greeting line.

## RULE 4: Sentence Continuity
- Ensure sentences flow naturally and never appear cut off or fragmented.
- If two sentences connect but lack punctuation or conjunction, join with an em dash (—) or period.
- NEVER use abbreviations (e.g. "Wd" → write "Wood" in full).

## RULE 5: Ten Gods Distribution Section
When translating the Ten Gods Distribution (십신 분포) section:
After the general description of each Ten God, add a personalized line starting with "In your chart:" based on the person's actual count from the chart data.

Count-based interpretation guide:
  0 = "This energy is absent in your chart, which may mean..."
  1 = "A moderate presence suggests a balanced..."
  2 = "A strong presence indicates a pronounced tendency toward..."
  3+ = "A dominant presence suggests this is a defining force in..."

## RULE 6: Notation Principles

Encouraged — K-Saju branding with Korean hangul:
- Include Korean originals in parentheses: Companion (비견 · 比肩), Direct Authority (정관 · 正官)
- Heavenly Stems/Branches include hangul: Gyeong (경 · 庚) · Yang Metal
- Section titles may feature Korean visually: "사주팔자 · Four Pillars of Destiny"

Forbidden:
- Romanized Korean alone without English translation (e.g. "Bigyeon" without "Companion")
- Duplicate element names (木 Wood Tree → just 木 Wood)
- Fragmented or cut-off sentences
- Hanja alone without Korean hangul or English alongside

## Translation Rules
1. Translate ALL content — every section, table, chart, diagram text
2. Use the terminology formats specified in Rule 1 above
3. Write natural, flowing English for Western readers (see Rule 3)
4. Use # for PART-level headings, ## for chapters, ### for subsections
5. Output ONLY clean, readable translation — no commentary about what you are doing

## Saju Terminology Reference
${getGlossaryForPrompt()}`;

export interface TranslationResult {
  translatedText: string;
  sections: { title: string; content: string }[];
  clientName: string; // extracted from "Dear [Name]," greeting
}

export function extractClientName(text: string): string {
  // Matches "Dear 전찬미," or "Dear Jeon Chan-mi," (up to 50 chars before the comma)
  const match = text.match(/\bDear\s+([^,\n]{1,50}),/);
  return match ? match[1].trim() : "";
}

export async function translateSajuPDF(
  pdfBuffer: Buffer
): Promise<TranslationResult> {
  const client = new Anthropic();
  const chunks = await splitPDFIntoChunks(pdfBuffer, CHUNK_SIZE);

  const chunkTexts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(INTER_CHUNK_DELAY_MS);
    const base64Chunk = chunks[i].toString("base64");
    const text = await translateChunkWithRetry(
      client,
      base64Chunk,
      i + 1,
      chunks.length
    );
    chunkTexts.push(text);
  }

  const combined = chunkTexts.join("\n\n");
  const cleaned = cleanTranslation(combined);
  const sections = parseIntoSections(cleaned);
  return { translatedText: cleaned, sections, clientName: extractClientName(cleaned) };
}

export async function translateChunkWithRetry(
  client: Anthropic,
  base64PDF: string,
  chunkNum: number,
  totalChunks: number
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await translateChunk(client, base64PDF, chunkNum, totalChunks);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status: number }).status
          : 0;
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        // Use retry-after header from server if available, otherwise fall back
        const retryAfterHeader =
          typeof err === "object" && err !== null && "headers" in err
            ? (err as { headers?: { get?: (k: string) => string | null } })
                .headers?.get?.("retry-after")
            : null;
        const waitMs = retryAfterHeader
          ? (parseInt(retryAfterHeader) + 10) * 1000
          : RATE_LIMIT_WAIT_MS;
        console.log(
          `Rate limited on chunk ${chunkNum}. Waiting ${waitMs / 1000}s (retry-after: ${retryAfterHeader ?? "n/a"})...`
        );
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

async function translateChunk(
  client: Anthropic,
  base64PDF: string,
  chunkNum: number,
  totalChunks: number
): Promise<string> {
  const isMultiChunk = totalChunks > 1;
  const basePrompt = isMultiChunk
    ? `This is part ${chunkNum} of ${totalChunks} of a Korean saju analysis. Translate all content on these pages into clean English. Do not include any garbled or unreadable characters in your output.`
    : "Translate all content of this Korean saju analysis PDF into clean English. Do not include any garbled or unreadable characters in your output.";

  let fullText = "";
  let continueFrom: string | null = null;

  for (let i = 0; i < 4; i++) {
    const userPrompt = continueFrom
      ? `Continue from after the section "${continueFrom}". Output ONLY remaining sections — do not repeat any content.`
      : basePrompt;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            /* eslint-disable @typescript-eslint/no-explicit-any */
            ...[{
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64PDF,
              },
            }] as any[],
            /* eslint-enable @typescript-eslint/no-explicit-any */
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") break;

    fullText += (fullText ? "\n\n" : "") + block.text;
    if (response.stop_reason !== "max_tokens") break;

    const headings = fullText.match(/^##\s+.+/gm);
    continueFrom = headings
      ? headings[headings.length - 1].replace(/^##\s+/, "").trim()
      : null;
    if (!continueFrom) break;
  }

  return fullText;
}

/**
 * Whitelist-based cleanup: keep ONLY allowed characters, remove everything else.
 * Allowed: printable ASCII (0x20-0x7E), newlines, tabs,
 *          CJK Unified Ideographs (木火土金水 etc.), Korean syllables (가-힣).
 * This removes ALL encoding artifacts regardless of their Unicode range.
 */
export function cleanTranslation(text: string): string {
  return (
    text
      // Whitelist: keep printable ASCII, newlines, CJK, Korean only
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00B7\u2014\u2022\u4E00-\u9FFF\uAC00-\uD7A3]/g, " ")
      // Clean up empty or near-empty parentheses: (), ( ), (,), ( , )
      .replace(/\(\s*,?\s*\)/g, "")
      // Clean up orphaned commas in parentheses: (Wood, ) → (Wood)
      .replace(/,\s*\)/g, ")")
      // Normalize whitespace
      .replace(/[ \t]{2,}/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export async function splitPDFIntoChunks(
  buffer: Buffer,
  chunkSize: number
): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer);
  const totalPages = pdfDoc.getPageCount();
  // Always split — large PDFs sent whole may exceed Claude's processing limit
  if (totalPages <= 1) return [buffer];

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages);
    const chunk = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const pages = await chunk.copyPages(pdfDoc, indices);
    pages.forEach((p) => chunk.addPage(p));
    chunks.push(Buffer.from(await chunk.save()));
  }
  return chunks;
}

export function parseIntoSections(
  text: string
): { title: string; content: string }[] {
  // Demote non-PART single-# headings (CHAPTER, monthly/annual fortune, etc.)
  // to ## so they render as chapter headings within a PART section instead of
  // creating their own dedicated page each.
  const normalized = text.replace(/^# (?!PART\b)/gim, "## ");

  const sections: { title: string; content: string }[] = [];
  // Split only on single # (PART level) — ## and ### stay inside content
  const parts = normalized.split(/\n(?=# [^#])/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (/^# [^#]/.test(trimmed)) {
      const nl = trimmed.indexOf("\n");
      const title = (nl > -1 ? trimmed.slice(2, nl) : trimmed.slice(2)).trim();
      const content = nl > -1 ? trimmed.slice(nl + 1).trim() : "";
      if (title) sections.push({ title, content });
    } else {
      if (sections.length === 0) {
        sections.push({ title: "Overview", content: trimmed });
      } else {
        sections[sections.length - 1].content += "\n\n" + trimmed;
      }
    }
  }

  return sections.length > 0
    ? sections.filter((s) => s.content.trim().length > 0)
    : [{ title: "Saju Analysis", content: text }];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
