"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import TranslationProgress, {
  TranslationStatus,
} from "@/components/TranslationProgress";
import DownloadResult from "@/components/DownloadResult";

type ReportType = "general" | "love";

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB per chunk
const DIRECT_LIMIT = 4 * 1024 * 1024; // 4MB — below this, send directly
const INTER_CHUNK_DELAY_MS = 3000; // 3s between translate-chunk calls

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const uploadChunks = async (file: File): Promise<string[]> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = crypto.randomUUID();
    const chunkUrls: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk, `chunk-${i}`);
      formData.append("uploadId", uploadId);
      formData.append("chunkIndex", i.toString());

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chunk upload failed");
      }

      const data = await res.json();
      console.log(`Chunk ${i}: uploaded ${data.size} bytes, url: ${data.url}`);
      chunkUrls.push(data.url);
    }

    return chunkUrls;
  };

  const handleLargeFile = async (file: File) => {
    if (!reportType) return;

    // Step 1: Upload file chunks to blob
    setStatus("extracting");
    setStatusDetail("Uploading file...");
    const chunkUrls = await uploadChunks(file);
    console.log("Chunk URLs:", JSON.stringify(chunkUrls));

    // Step 2: Call /api/split-pdf to split into page chunks
    setStatusDetail("Splitting PDF into pages...");
    const splitRes = await fetch("/api/split-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkUrls }),
    });

    if (!splitRes.ok) {
      const data = await splitRes.json();
      throw new Error(data.error || "PDF split failed");
    }

    const { pageChunkUrls, totalChunks } = await splitRes.json();
    console.log(`Split into ${totalChunks} page chunks`);

    // Step 3: Translate each chunk sequentially
    setStatus("translating");
    const translatedTexts: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
      setStatusDetail(`Translating section ${i + 1} of ${totalChunks}...`);

      if (i > 0) {
        await sleep(INTER_CHUNK_DELAY_MS);
      }

      const translateRes = await fetch("/api/translate-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: pageChunkUrls[i],
          chunkNum: i + 1,
          totalChunks,
        }),
      });

      if (!translateRes.ok) {
        const data = await translateRes.json();
        throw new Error(data.error || `Translation of chunk ${i + 1} failed`);
      }

      const { text } = await translateRes.json();
      translatedTexts.push(text);
    }

    // Step 4: Generate final PDF
    setStatus("generating");
    setStatusDetail("Generating English PDF...");

    const generateRes = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: translatedTexts,
        type: reportType,
        pageChunkUrls,
      }),
    });

    if (!generateRes.ok) {
      const data = await generateRes.json();
      throw new Error(data.error || "PDF generation failed");
    }

    return await generateRes.blob();
  };

  const handleFileSelect = async (file: File) => {
    if (!reportType) return;
    setStatus("extracting");
    setStatusDetail("");
    setError("");
    setPdfBlob(null);

    try {
      let resultBlob: Blob;

      if (file.size <= DIRECT_LIMIT) {
        // Small file: send directly via FormData (single-call flow)
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", reportType);

        const timer1 = setTimeout(() => {
          setStatus((prev) => (prev === "extracting" ? "translating" : prev));
        }, 2000);
        const timer2 = setTimeout(() => {
          setStatus((prev) => (prev === "translating" ? "generating" : prev));
        }, 8000);

        const response = await fetch("/api/translate", {
          method: "POST",
          body: formData,
        });

        clearTimeout(timer1);
        clearTimeout(timer2);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Translation failed");
        }

        resultBlob = await response.blob();
      } else {
        // Large file: chunked split → translate → generate flow
        const blob = await handleLargeFile(file);
        if (!blob) throw new Error("No result returned");
        resultBlob = blob;
      }

      setPdfBlob(resultBlob);
      setStatus("done");
      setStatusDetail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
      setStatusDetail("");
    }
  };

  const handleReset = () => {
    setReportType(null);
    setStatus("idle");
    setStatusDetail("");
    setError("");
    setPdfBlob(null);
  };

  const isProcessing = ["extracting", "translating", "generating"].includes(
    status
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Saju Translation
          </h1>
          <p className="text-lg text-gray-600">
            Upload a Korean Saju (Four Pillars) analysis PDF
            <br />
            and get a professionally translated English version.
          </p>
        </div>

        {/* Report Type Selector */}
        {!reportType && status === "idle" && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setReportType("general")}
              className="group relative flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-gray-200
                         hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200"
            >
              <span className="text-4xl">&#9776;</span>
              <span className="text-lg font-semibold text-gray-800 group-hover:text-indigo-700">
                Comprehensive
              </span>
              <span className="text-sm text-gray-500 group-hover:text-indigo-500">
                Full Destiny Analysis
              </span>
            </button>
            <button
              onClick={() => setReportType("love")}
              className="group relative flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-gray-200
                         hover:border-rose-400 hover:bg-rose-50 transition-all duration-200"
            >
              <span className="text-4xl">&#9829;</span>
              <span className="text-lg font-semibold text-gray-800 group-hover:text-rose-600">
                Love Destiny
              </span>
              <span className="text-sm text-gray-500 group-hover:text-rose-400">
                Romance & Compatibility
              </span>
            </button>
          </div>
        )}

        {/* Selected type badge + Upload Area */}
        {reportType && status !== "done" && !isProcessing && status !== "error" && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium ${
                  reportType === "general"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {reportType === "general" ? "\u2630 Comprehensive" : "\u2665 Love Destiny"}
              </span>
              <button
                onClick={() => setReportType(null)}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Change
              </button>
            </div>
            <FileUpload onFileSelect={handleFileSelect} disabled={false} />
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <TranslationProgress status={status} detail={statusDetail} />
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mt-6">
            <TranslationProgress status={status} error={error} />
            <div className="text-center mt-4">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Download */}
        {status === "done" && (
          <DownloadResult
            pdfBlob={pdfBlob}
            onReset={handleReset}
            reportType={reportType ?? "general"}
          />
        )}

        {/* Footer info */}
        <div className="mt-16 text-center text-sm text-gray-400">
          <p>
            Powered by Claude AI. Saju terminology is preserved with original
            Chinese characters.
          </p>
        </div>
      </div>
    </main>
  );
}
