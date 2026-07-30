"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1F3A",
          color: "#fff",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            SecureTrack ERP
          </h1>
          <p style={{ opacity: 0.8, marginBottom: 20 }}>
            A critical error occurred. Please reload the application.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#C9A227",
              color: "#0B1F3A",
              border: 0,
              padding: "10px 20px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
