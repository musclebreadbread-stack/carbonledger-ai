"use client";

/**
 * Last-resort boundary for an error thrown by the root layout itself.
 *
 * This file replaces the root layout, which means `NextIntlClientProvider` is
 * gone and `useTranslations` would throw — inside an error boundary, throwing
 * again produces a blank page. So the copy is inlined rather than looked up, and
 * it is inlined in Korean because Korean is the product default; the English line
 * follows for anyone who has switched languages and is now looking at a screen
 * that cannot know it.
 *
 * `<html lang="ko">` for the same reason. Nothing here reads the locale cookie:
 * this component may render when the layout that reads it is the thing that
 * failed.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#ffffff",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          오류가 발생했습니다
        </h1>
        <p style={{ margin: 0, maxWidth: "32rem", color: "#475569" }}>
          애플리케이션을 표시할 수 없습니다. 다시 시도해 주십시오.
        </p>
        <p style={{ margin: 0, maxWidth: "32rem", fontSize: "0.875rem", color: "#64748b" }}>
          The application could not be rendered. Please try again.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b" }}>
            {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            appearance: "none",
            border: "none",
            borderRadius: "0.375rem",
            background: "#15803d",
            color: "#ffffff",
            padding: "0.5rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          다시 시도 / Try again
        </button>
      </body>
    </html>
  );
}
