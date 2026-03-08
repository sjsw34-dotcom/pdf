import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunkUrls } = body as { chunkUrls: string[] };

    if (!chunkUrls || chunkUrls.length === 0) {
      return NextResponse.json({ error: "No chunks" }, { status: 400 });
    }

    const chunks: Buffer[] = [];
    for (const url of chunkUrls) {
      const res = await fetch(url);
      if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 500 });
      chunks.push(Buffer.from(await res.arrayBuffer()));
    }

    const buffer = Buffer.concat(chunks);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reassembled.pdf"`,
        "X-Total-Size": buffer.length.toString(),
        "X-Chunk-Count": chunkUrls.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown",
    }, { status: 500 });
  }
}
