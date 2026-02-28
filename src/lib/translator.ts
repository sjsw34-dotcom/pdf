import Anthropic from "@anthropic-ai/sdk";
import { getGlossaryForPrompt } from "./saju-glossary";

const SYSTEM_PROMPT = `You are an expert translator specializing in Korean Saju (四柱, Four Pillars of Destiny) analysis documents. Translate the provided Korean saju PDF into clear, natural English.

## Rules
1. Translate ALL content — including text inside charts, tables, and diagrams
2. For saju terms use: English Name (漢字, Korean romanization) — e.g. "Day Master (日干, Ilgan)", "Wood Element (木, Mok)"
3. Write natural, flowing English for Western readers
4. Preserve document structure: use ## for major sections, ### for subsections
5. Convert tables/charts to readable text — describe values clearly
6. Do NOT output garbled characters or encoding artifacts — only clean, meaningful text
7. Do NOT add commentary about what you're doing — output only the translation

## Saju Terminology Reference
${getGlossaryForPrompt()}`;

export interface TranslationResult {
  translatedText: string;
  sections: { title: string; content: string }[];
}

export async function translateSajuPDF(
  pdfBuffer: Buffer
): Promise<TranslationResult> {
  const client = new Anthropic();
  const base64PDF = pdfBuffer.toString("base64");

  const translatedText = await doTranslation(client, base64PDF);
  const sections = parseIntoSections(translatedText);

  return { translatedText, sections };
}

async function doTranslation(
  client: Anthropic,
  base64PDF: string
): Promise<string> {
  let fullText = "";
  let continueFrom: string | null = null;
  const MAX_ITERATIONS = 4;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const userPrompt = continueFrom
      ? `The document has already been partially translated. The last section translated was: "${continueFrom}". Now continue translating from the NEXT section onwards. Output ONLY the sections that come AFTER "${continueFrom}" — do not repeat any already-translated content.`
      : "Translate the complete content of this Korean saju analysis PDF into English. Include every section, table, chart description, and any visible text.";

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
                    // PDF document block — SDK types don't expose this yet for newer models
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

    // If not truncated, we're done
    if (response.stop_reason !== "max_tokens") break;

    // Find the last ## section heading to continue from there
    const headings = fullText.match(/^##\s+.+/gm);
    const lastHeading = headings?.[headings.length - 1];
    continueFrom = lastHeading ? lastHeading.replace(/^##\s+/, "").trim() : null;
    if (!continueFrom) break;
  }

  return fullText;
}

function parseIntoSections(
  text: string
): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];

  // Split on lines that start with ##
  const parts = text.split(/\n(?=##\s)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      const newlineIdx = trimmed.indexOf("\n");
      const title =
        newlineIdx > -1
          ? trimmed.slice(3, newlineIdx).trim()
          : trimmed.slice(3).trim();
      const content = newlineIdx > -1 ? trimmed.slice(newlineIdx + 1).trim() : "";
      if (title) sections.push({ title, content });
    } else {
      // Pre-section content (intro paragraph etc.)
      if (sections.length === 0) {
        sections.push({ title: "Overview", content: trimmed });
      } else {
        sections[sections.length - 1].content += "\n\n" + trimmed;
      }
    }
  }

  if (sections.length === 0) {
    sections.push({ title: "Saju Analysis", content: text });
  }

  return sections.filter((s) => s.content.trim().length > 0);
}
