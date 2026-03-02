import { generatePDF } from "../src/lib/pdf-generator-v2";
import { TranslationResult } from "../src/lib/translator";
import * as fs from "fs";

const text = fs.readFileSync("test/debug-translation.txt", "utf-8");

const sections: { title: string; content: string }[] = [];
// Split on single # (PART level) only — ## and ### stay inside content
const parts = text.split(/\n(?=# [^#])/);

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

const filtered = sections.filter((s) => s.content.trim().length > 0);
const result: TranslationResult = {
  translatedText: text,
  sections: filtered.length > 0 ? filtered : [{ title: "Saju Analysis", content: text }],
};

generatePDF(result).then((pdfBuffer) => {
  fs.writeFileSync("test/result-v2.pdf", pdfBuffer);
  console.log("PDF generated:", pdfBuffer.length, "bytes");
  console.log("Sections:", filtered.length);
});
