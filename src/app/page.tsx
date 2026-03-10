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
const INTER_CHUNK_DELAY_MS = 2000; // 2s between translate-chunk calls
const MAX_CHUNK_RETRIES = 3; // retry failed chunk translations
const PARALLEL_BATCH_SIZE = 3; // translate 3 chunks concurrently

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [customText, setCustomText] = useState<string>("");

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

  const handleChunkedTranslation = async (file: File) => {
    if (!reportType) return;

    const isLarge = file.size > DIRECT_LIMIT;

    // Step 1: Split PDF into page chunks
    setStatus("extracting");
    let splitBody: BodyInit;
    let splitHeaders: HeadersInit | undefined;

    if (isLarge) {
      // Large file: upload chunks to blob first
      setStatusDetail("Uploading file...");
      const chunkUrls = await uploadChunks(file);
      console.log("Chunk URLs:", JSON.stringify(chunkUrls));
      setStatusDetail("Splitting PDF into pages...");
      splitBody = JSON.stringify({ chunkUrls });
      splitHeaders = { "Content-Type": "application/json" };
    } else {
      // Small file: send directly
      setStatusDetail("Splitting PDF into pages...");
      const formData = new FormData();
      formData.append("file", file);
      splitBody = formData;
    }

    const splitRes = await fetch("/api/split-pdf", {
      method: "POST",
      headers: splitHeaders,
      body: splitBody,
    });

    if (!splitRes.ok) {
      const data = await splitRes.json();
      throw new Error(data.error || "PDF split failed");
    }

    const { pageChunkUrls, totalChunks } = await splitRes.json();
    console.log(`Split into ${totalChunks} page chunks`);

    // Step 3: Translate chunks in parallel batches
    setStatus("translating");
    const translatedTexts: string[] = new Array(totalChunks);

    const translateOneChunk = async (chunkIndex: number): Promise<void> => {
      let lastError = "";

      for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
        if (attempt > 0) {
          const backoffMs = lastError.includes("Rate limited")
            ? 60000 + attempt * 15000
            : Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          await sleep(backoffMs);
        }

        try {
          const translateRes = await fetch("/api/translate-chunk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: pageChunkUrls[chunkIndex],
              chunkNum: chunkIndex + 1,
              totalChunks,
            }),
          });

          if (!translateRes.ok) {
            const data = await translateRes.json();
            lastError = data.error || `Translation of chunk ${chunkIndex + 1} failed`;
            continue;
          }

          const { text } = await translateRes.json();
          translatedTexts[chunkIndex] = text;
          return;
        } catch (err) {
          lastError =
            err instanceof Error ? err.message : `Chunk ${chunkIndex + 1} network error`;
        }
      }

      throw new Error(lastError || `Translation of chunk ${chunkIndex + 1} failed after ${MAX_CHUNK_RETRIES} attempts`);
    };

    // Process in parallel batches
    for (let batchStart = 0; batchStart < totalChunks; batchStart += PARALLEL_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PARALLEL_BATCH_SIZE, totalChunks);
      const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

      setStatusDetail(
        `Translating sections ${batchStart + 1}–${batchEnd} of ${totalChunks} (parallel)...`
      );

      if (batchStart > 0) {
        await sleep(INTER_CHUNK_DELAY_MS);
      }

      const results = await Promise.allSettled(
        batchIndices.map((idx) => translateOneChunk(idx))
      );

      // Check for failures
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        throw reason instanceof Error ? reason : new Error(String(reason));
      }
    }

    // Step 3.5: Translate custom text if provided
    let translatedCustomText = "";
    if (customText.trim()) {
      setStatusDetail("Translating additional text...");
      const textRes = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customText.trim() }),
      });
      if (textRes.ok) {
        const { translatedText } = await textRes.json();
        translatedCustomText = translatedText;
      }
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
        customText: translatedCustomText,
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
      // All files go through the per-chunk flow:
      // split-pdf → translate-chunk (loop) → generate-pdf
      const blob = await handleChunkedTranslation(file);
      if (!blob) throw new Error("No result returned");
      const resultBlob = blob;

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
    setCustomText("");
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

            {/* Custom text input */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Text (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Enter Korean text here to include a translated version after the Table of Contents.
              </p>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="여기에 추가할 한국어 텍스트를 입력하세요..."
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800
                           placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:outline-none transition-all resize-y text-sm"
              />
            </div>
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
