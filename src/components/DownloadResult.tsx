"use client";

interface DownloadResultProps {
  pdfBlob: Blob | null;
  onReset: () => void;
  reportType: "general" | "love";
}

export default function DownloadResult({ pdfBlob, onReset, reportType }: DownloadResultProps) {
  if (!pdfBlob) return null;

  const filename =
    reportType === "love"
      ? "love-destiny-english.pdf"
      : "saju-analysis-english.pdf";

  const handleDownload = () => {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 text-center">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
        <svg
          className="w-16 h-16 text-green-500 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-green-800 mb-2">
          Translation Complete!
        </h3>
        <p className="text-green-600 mb-6">
          {reportType === "love"
            ? "Your Love Destiny report has been translated to English."
            : "Your Saju analysis has been translated to English."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium
                       hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            Download PDF
          </button>
          <button
            onClick={onReset}
            className="px-6 py-3 bg-white text-gray-700 rounded-xl font-medium
                       border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Translate Another
          </button>
        </div>
      </div>
    </div>
  );
}
