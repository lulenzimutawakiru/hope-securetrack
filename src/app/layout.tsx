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
  applicationName: "SecureTrack ERP",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL("https://hope-securetrack.vercel.app"),
  openGraph: {
    title: "SecureTrack ERP - Enterprise Business Operating System",
    description:
      "AI-powered, cloud-native Enterprise Business Operating System. Unify finance, HR, manufacturing, supply chain, CRM, payroll, assets, service desk, analytics, and AI on one secure, multi-tenant platform.",
    url: "https://hope-securetrack.vercel.app",
    siteName: "SecureTrack ERP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SecureTrack ERP - Enterprise Business Operating System",
    description:
      "Run your entire enterprise on one intelligent, AI-powered, cloud-native platform.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00325B" },
    { media: "(prefers-color-scheme: dark)", color: "#00325B" },
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
