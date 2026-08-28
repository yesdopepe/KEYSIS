"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: this one replaces the root layout, so it cannot use
 * the app's components or Tailwind tokens — it renders its own <html>/<body>
 * and inlines its styles. Reached only when the failure is in the root layout
 * itself; everything else stops at app/error.tsx.
 */
export default function KokHatasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Kök hata:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Uygulama başlatılamadı
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1rem" }}>
            Beklenmeyen bir hata oluştu. Sorun sürerse aşağıdaki hata kodunu sistem
            yöneticinize iletin.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#475569",
                background: "#e2e8f0",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              Hata kodu: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              border: "none",
              borderRadius: "0.5rem",
              background: "#1e40af",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
