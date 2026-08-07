import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { BrandProvider } from "@/components/providers/brand-provider";
import { SentryClientInit } from "@/components/providers/sentry-client-init";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SecureTrack ERP",
    template: "%s | SecureTrack ERP",
  },
  description:
    "SecureTrack ERP — AI-powered, cloud-native Enterprise Business Operating System. Unify finance, HR, manufacturing, supply chain, CRM, payroll, assets, service desk, analytics, and AI on one secure, multi-tenant platform.",
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
                <BrandProvider>
                  {children}
                  <Toaster />
                </BrandProvider>
              </UserProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
