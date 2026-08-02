const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QR_ENCRYPTION_KEY",
  "QR_SIGNING_PRIVATE_KEY",
  "QR_SIGNING_PUBLIC_KEY",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required environment variables:\n" + missing.map((m) => ` - ${m}`).join('\n'));
  console.error('\nSet these in CI or .env.* before running E2E or deploying.');
  process.exit(1);
}
console.log('All required secrets present.');
process.exit(0);
