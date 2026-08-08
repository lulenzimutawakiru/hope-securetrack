import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "SecureTrack ERP · Run your entire enterprise on one intelligent, AI-powered platform.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SHIELD = `M24 3 40.5 9.5 38.6 22.6C37.9 32.5 32 40.2 24 44.4 16 40.2 10.1 32.5 9.4 22.6L7.5 9.5 24 3Z`;

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#00325B",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-160px",
            right: "-120px",
            width: "520px",
            height: "520px",
            borderRadius: "9999px",
            backgroundColor: "rgba(27,144,255,0.22)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="stg" x1="7" y1="3" x2="41" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00538C" />
                <stop offset="0.55" stopColor="#0064D8" />
                <stop offset="1" stopColor="#1B90FF" />
              </linearGradient>
            </defs>
            <path d={SHIELD} fill="url(#stg)" />
            <path d="M15.6 24.6 21.2 30.2 32.6 18.2" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="15.6" cy="24.6" r="2.1" fill="#F0AB00" />
            <circle cx="32.6" cy="18.2" r="2.1" fill="#F0AB00" />
          </svg>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "30px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            <span>SecureTrack ERP</span>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              The Autonomous Enterprise ERP · Built for Africa
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              width: "88px",
              height: "8px",
              borderRadius: "9999px",
              backgroundColor: "#F0AB00",
              marginBottom: "28px",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              maxWidth: "920px",
            }}
          >
            <span>Run your entire enterprise</span>
            <span style={{ color: "#A6DAFB" }}>on one intelligent platform</span>
          </div>
          <div
            style={{
              marginTop: "28px",
              fontSize: "26px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.82)",
              maxWidth: "880px",
            }}
          >
            Finance · HR · Manufacturing · Supply Chain · CRM · Payroll · AI · unified,
            secure, and tenant-isolated.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "20px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <span>securetrackerp.com</span>
          <span>ISO 27001 Ready · 99.99% uptime</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
