"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import TranslationProgress, {
  TranslationStatus,
} from "@/components/TranslationProgress";
import DownloadResult from "@/components/DownloadResult";

type ReportType = "general" | "love";

export default function Home() {
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [error, setError] = useState<string>("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const handleFileSelect = async (file: File) => {
    if (!reportType) return;
    setStatus("extracting");
    setError("");
    setPdfBlob(null);

    try {
      // Step 1: Upload to Vercel Blob via Edge PUT
      const uploadRes = await fetch(
        `/api/upload?filename=${encodeURIComponent(file.name)}`,
        { method: "PUT", body: file }
      );

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }

      const blob = await uploadRes.json();
      setStatus("translating");

      const timer = setTimeout(() => {
        setStatus((prev) => (prev === "translating" ? "generating" : prev));
      }, 8000);

      // Step 2: Send blob URL to translate API
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, type: reportType }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Translation failed");
      }

      const resultBlob = await response.blob();
      setPdfBlob(resultBlob);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setReportType(null);
    setStatus("idle");
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
        {isProcessing && <TranslationProgress status={status} />}

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
