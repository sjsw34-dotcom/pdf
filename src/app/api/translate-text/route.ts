import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are an expert translator specializing in Korean Saju (四柱, Four Pillars of Destiny) analysis documents. Translate the provided Korean text into clear, natural English.

## Terminology Format
All saju terms MUST follow the format: English Name (한글 · 漢字)
- NEVER use romanized Korean alone
- Korean hangul in parentheses is ENCOURAGED

## Tone and Style
- Use natural, warm, approachable English
- Prefer active voice over passive voice
- Ensure sentences flow naturally

## Translation Rules
1. Translate ALL content faithfully
2. Output ONLY clean, readable translation — no commentary
3. Preserve paragraph structure using blank lines
4. Use ## for section headings if the source text has clear sections`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Translate the following Korean text into English:\n\n${text.trim()}`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ translatedText: block.text });
  } catch (error) {
    console.error("Text translation error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `Translation failed: ${message}` },
      { status: 500 }
    );
  }
}
