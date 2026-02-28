"use client";

export type TranslationStatus =
  | "idle"
  | "extracting"
  | "translating"
  | "generating"
  | "done"
  | "error";

interface TranslationProgressProps {
  status: TranslationStatus;
  error?: string;
}

const steps = [
  { key: "extracting", label: "Extracting text from PDF" },
  { key: "translating", label: "Translating with AI" },
  { key: "generating", label: "Generating English PDF" },
] as const;

const statusOrder: TranslationStatus[] = [
  "idle",
  "extracting",
  "translating",
  "generating",
  "done",
];

export default function TranslationProgress({
  status,
  error,
}: TranslationProgressProps) {
  if (status === "idle") return null;

  const currentIndex = statusOrder.indexOf(status);

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      {status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <svg
            className="w-8 h-8 text-red-500 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-red-700 font-medium">Translation Failed</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => {
            const stepIndex = statusOrder.indexOf(step.key);
            const isActive = step.key === status;
            const isComplete = currentIndex > stepIndex;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500 text-sm">{index + 1}</span>
                    </div>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive
                      ? "text-blue-700 font-medium"
                      : isComplete
                        ? "text-green-700"
                        : "text-gray-400"
                  }`}
                >
                  {step.label}
                  {isActive && "..."}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
