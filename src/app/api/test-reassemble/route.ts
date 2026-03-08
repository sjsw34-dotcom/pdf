import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunkUrls } = body as { chunkUrls: string[] };

    if (!chunkUrls || chunkUrls.length === 0) {
      return NextResponse.json({ error: "No chunks" }, { status: 400 });
    }

    const chunks: Buffer[] = [];
    const chunkSizes: number[] = [];
    for (const url of chunkUrls) {
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json({
          error: `Fetch failed: ${res.status} ${res.statusText}`,
          url,
        }, { status: 500 });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      chunkSizes.push(buf.length);
      chunks.push(buf);
    }

    const buffer = Buffer.concat(chunks);

    // Check if it starts with PDF magic bytes
    const isPDF = buffer.length > 4 && buffer.slice(0, 5).toString() === "%PDF-";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reassembled.pdf"`,
        "X-Total-Size": buffer.length.toString(),
        "X-Chunk-Sizes": chunkSizes.join(","),
        "X-Is-PDF": isPDF.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown",
    }, { status: 500 });
  }
}
