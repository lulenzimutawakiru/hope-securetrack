"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";

/** Legacy HR recruitment entry — redirects to Enterprise Talent Acquisition */
export default function RecruitmentPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/talent");
  }, [router]);

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Redirecting to Talent Acquisition…"
        actions={
          <Button asChild>
            <Link href="/dashboard/talent">
              Open Talent Acquisition <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <UserPlus className="h-5 w-5" />
          Enterprise Talent Acquisition replaces the legacy recruitment list.
        </CardContent>
      </Card>
      <LoadingState message="Opening Talent Acquisition…" />
    </div>
  );
}
