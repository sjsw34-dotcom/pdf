"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import TranslationProgress, {
  TranslationStatus,
} from "@/components/TranslationProgress";
import DownloadResult from "@/components/DownloadResult";

export default function Home() {
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [error, setError] = useState<string>("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const handleFileSelect = async (file: File) => {
    setStatus("extracting");
    setError("");
    setPdfBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress stages since all steps happen server-side
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

      const blob = await response.blob();
      setPdfBlob(blob);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  };

  const handleReset = () => {
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

        {/* Upload Area */}
        {status !== "done" && !isProcessing && (
          <FileUpload onFileSelect={handleFileSelect} disabled={false} />
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
          <DownloadResult pdfBlob={pdfBlob} onReset={handleReset} />
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
