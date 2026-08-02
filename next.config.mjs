import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // your existing Next.js configuration can be merged here
};

export default withNextIntl(nextConfig);
