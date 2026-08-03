import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { SentryClientInit } from "@/components/providers/sentry-client-init";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SecureTrack ERP",
    template: "%s | SecureTrack ERP",
  },
  description:
    "SecureTrack ERP — Secure · Intelligent · Connected. Multi-tenant enterprise OS for manufacturing, finance, payroll, sales, fleet, attendance, identity & BI.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B1F3A" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1F3A" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SentryClientInit />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <NextIntlClientProvider messages={messages}>
              <UserProvider>
                {children}
                <Toaster />
              </UserProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
