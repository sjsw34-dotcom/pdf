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
    const isPDF = buffer.length > 4 && buffer.slice(0, 5).toString() === "%PDF-";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"reassembled.pdf\"",
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

export async function GET() {
  const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto">
<h2>Chunk Reassembly Test</h2>
<p>Paste chunk URLs (one per line):</p>
<textarea id="urls" rows="4" style="width:100%"></textarea><br><br>
<button id="btn" style="padding:10px 20px;font-size:16px">Download Reassembled PDF</button>
<p id="status"></p>
<script>
document.getElementById("btn").onclick = async function() {
  var st = document.getElementById("status");
  var text = document.getElementById("urls").value.trim();
  if (!text) { st.textContent = "Enter URLs"; return; }
  var urls = text.split("\\n").map(function(s){return s.trim()}).filter(Boolean);
  st.textContent = "Downloading " + urls.length + " chunks...";
  try {
    var parts = [];
    for (var i = 0; i < urls.length; i++) {
      var r = await fetch(urls[i]);
      parts.push(await r.arrayBuffer());
      st.textContent = "Downloaded chunk " + (i+1) + "/" + urls.length + " (" + parts[i].byteLength + " bytes)";
    }
    var total = 0;
    for (var j = 0; j < parts.length; j++) total += parts[j].byteLength;
    st.textContent = "Combining... Total: " + total + " bytes";
    var blob = new Blob(parts, {type: "application/pdf"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reassembled.pdf";
    a.click();
    st.textContent = "Done! Total: " + total + " bytes. Check if PDF opens.";
  } catch(e) {
    st.textContent = "Error: " + e.message;
  }
};
</script>
</body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
