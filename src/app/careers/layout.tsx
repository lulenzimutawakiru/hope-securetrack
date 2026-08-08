import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join SecureTrack ERP and help build the enterprise operating system powering businesses across Africa. Explore open roles in engineering, product, sales, and operations.",
};

export default function CareersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
