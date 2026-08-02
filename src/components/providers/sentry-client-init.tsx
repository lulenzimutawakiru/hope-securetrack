"use client";

/**
 * Loads the Sentry browser SDK once on the client. Rendered as a no-op node in
 * the root layout so browser errors, unhandled rejections and React error
 * boundaries are reported. Init is skipped when NEXT_PUBLIC_SENTRY_DSN is unset.
 */
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function SentryClientInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      tracesSampleRate: 0.2,
      environment: process.env.NODE_ENV,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }, []);

  return null;
}
