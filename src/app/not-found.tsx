import Link from "next/link";
import { Shield, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root-level 404 page. Branded fallback for unknown routes anywhere in the
 * app; provides a safe path back to the dashboard without leaking tenant or
 * module context.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
        <Shield className="h-8 w-8 text-brand" />
      </div>
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">
          <Home className="mr-2 h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
