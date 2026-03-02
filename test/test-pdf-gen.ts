import { generatePDF } from "../src/lib/pdf-generator";
import { TranslationResult } from "../src/lib/translator";
import * as fs from "fs";

const text = fs.readFileSync("test/debug-translation.txt", "utf-8");

const sections: { title: string; content: string }[] = [];
const re = /\n(?=## )/;
const parts = text.split(re);

for (const part of parts) {
  const trimmed = part.trim();
  if (!trimmed) continue;
  if (trimmed.startsWith("## ")) {
    const nl = trimmed.indexOf("\n");
    const title = (nl > -1 ? trimmed.slice(3, nl) : trimmed.slice(3)).trim();
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
  clientName: "전찬미",
};

const pdfBuffer = generatePDF(result);
fs.writeFileSync("test/result-with-font.pdf", pdfBuffer);
console.log("PDF generated:", pdfBuffer.length, "bytes");
console.log("Sections:", filtered.length);
