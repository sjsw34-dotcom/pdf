// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export interface ParsedSection {
  title: string;
  content: string;
}

export interface ParsedPDF {
  fullText: string;
  sections: ParsedSection[];
  pageCount: number;
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const data = await pdfParse(buffer);

  const fullText = data.text;
  const sections = splitIntoSections(fullText);

  return {
    fullText,
    sections,
    pageCount: data.numpages,
  };
}

function splitIntoSections(text: string): ParsedSection[] {
  // Split by common section patterns in Korean saju PDFs
  // Look for lines that appear to be headers (short lines, possibly with special characters)
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentTitle = "Introduction";
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heuristic: a section header is a short line (< 40 chars) that doesn't end with
    // typical sentence endings and contains Korean or special markers
    if (isSectionHeader(trimmed)) {
      if (currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join("\n"),
        });
      }
      currentTitle = trimmed;
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  // Push the last section
  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join("\n"),
    });
  }

  // If no sections were detected, return the full text as one section
  if (sections.length === 0) {
    sections.push({
      title: "Saju Analysis",
      content: text,
    });
  }

  return sections;
}

function isSectionHeader(line: string): boolean {
  // Common patterns for section headers in saju PDFs
  const headerPatterns = [
    /^[■◆●▶★☆◇▷►※【】\[\]]+/, // Special markers
    /^[0-9]+[.)\]]\s/, // Numbered sections
    /^[가-힣]{2,10}\s*[:\-]?\s*$/, // Short Korean text alone on a line
    /^<.+>$/, // Angle-bracket wrapped
    /^[\[【].+[\]】]$/, // Bracket-wrapped titles
  ];

  if (line.length > 50) return false;

  return headerPatterns.some((pattern) => pattern.test(line));
}
