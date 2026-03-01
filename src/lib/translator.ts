import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { getGlossaryForPrompt } from "./saju-glossary";

const CHUNK_SIZE = 30;
const INTER_CHUNK_DELAY_MS = 10000; // 10s between chunks
const RATE_LIMIT_WAIT_MS = 95000;   // fallback wait (95s > server's 90s retry-after)
const MAX_RETRIES = 4;

const SYSTEM_PROMPT = `You are an expert translator specializing in Korean Saju (四柱, Four Pillars of Destiny) analysis documents. Translate the provided Korean saju PDF into clear, natural English.

## CRITICAL: Handling Encoding Artifacts
This PDF uses custom font encoding. Some characters may render as garbled symbols such as:
•›  Xì  vx  u2  NY  kc[˜  ˜ßy^  hC‚±kº  N¥  ]ñ  ¼ÅHÀ´  and similar patterns.

These are NOT real text — they are encoding artifacts. Rules:
- NEVER include garbled characters in your output
- Based on context and position in the document, determine the original Korean/Chinese meaning and translate it
- If a garbled sequence appears where a Heavenly Stem should be, write the correct name (Gap, Eul, Byeong, Jeong, Mu, Gi, Gyeong, Sin, Im, Gye)
- If it appears where an Earthly Branch should be, write the correct name (Ja, Chuk, In, Myo, Jin, Sa, O, Mi, Sin, Yu, Sul, Hae)
- If meaning cannot be determined, omit the garbled sequence entirely

## Saju Chart Formatting
When you encounter the Four Pillars chart (사주 원국표), format it as a clear text table:

Example output format:
┌─────────────────────────────────────────────────────┐
│              FOUR PILLARS BIRTH CHART               │
├──────────────┬──────────────┬──────────────┬────────┤
│  Hour Pillar │  Day Pillar  │ Month Pillar │  Year  │
│   (시주)      │   (일주)      │   (월주)      │ (년주) │
├──────────────┼──────────────┼──────────────┼────────┤
│  Ten Gods    │  Day Master  │  Ten Gods    │Ten Gods│
│  (십성)       │   (일간)      │  (십성)       │ (십성) │
├──────────────┼──────────────┼──────────────┼────────┤
│ Heavenly Stem│Heavenly Stem │Heavenly Stem │H. Stem │
│  Im (壬)     │  Gyeong (庚) │   Mu (戊)    │Eul (乙)│
├──────────────┼──────────────┼──────────────┼────────┤
│Earthly Branch│Earthly Branch│Earthly Branch│E. Brnch│
│   O (午)     │   In (寅)    │   Ja (子)    │Myo (卯)│
└──────────────┴──────────────┴──────────────┴────────┘

For element analysis tables (용신분석, 오행분석), format them as labeled lists:
• Favorable Element (용신): Metal (金)
• Joyful Element (희신): Earth (土)
• Unfavorable Element (기신): Fire (火)

## Translation Rules
1. Translate ALL content — every section, table, chart, diagram text
2. For saju terms: English Name (漢字, Korean) — e.g. "Day Master (日干, Ilgan)"
3. Write natural, flowing English for Western readers
4. Use # for PART-level headings, ## for chapters, ### for subsections
5. Output ONLY clean, readable translation — no commentary about what you are doing

## Proper Nouns — Do NOT translate or explain
- 사주팔자 (四柱八字) → write as **Saju Palja** (proper noun, no parenthetical explanation)
- 사주 (四柱) → write as **Saju** (no explanation; the introduction page already covers this)
- 팔자 (八字) → write as **Palja**
These terms are brand identity for this report. The reader will find explanations in the introduction. Do not append meanings like "(Four Pillars of Destiny)" or "(Eight Characters)" after them.

## Saju Terminology
${getGlossaryForPrompt()}`;

export interface TranslationResult {
  translatedText: string;
  sections: { title: string; content: string }[];
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
  return { translatedText: cleaned, sections };
}

async function translateChunkWithRetry(
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
function cleanTranslation(text: string): string {
  return (
    text
      // Whitelist: keep printable ASCII, newlines, CJK, Korean only
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u2022\u4E00-\u9FFF\uAC00-\uD7A3]/g, " ")
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

async function splitPDFIntoChunks(
  buffer: Buffer,
  chunkSize: number
): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer);
  const totalPages = pdfDoc.getPageCount();
  if (totalPages <= chunkSize) return [buffer];

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

function parseIntoSections(
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
