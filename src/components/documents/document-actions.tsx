"use client";

import { useState } from "react";
import { Printer, Download, FileSpreadsheet, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type BusinessDocument,
  printDocument,
  downloadDocumentHtml,
  downloadDocumentCsv,
} from "@/lib/documents";
import { applyCompanyBrandToDoc } from "@/lib/documents-brand";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type Props = {
  doc: BusinessDocument | (() => BusinessDocument | Promise<BusinessDocument>);
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  showLabel?: boolean;
  className?: string;
};

async function resolveDoc(
  doc: Props["doc"]
): Promise<BusinessDocument> {
  return typeof doc === "function" ? await doc() : doc;
}

export function DocumentActions({
  doc,
  size = "sm",
  variant = "outline",
  showLabel = true,
  className,
}: Props) {
  const [busy, setBusy] = useState<"print" | "html" | "csv" | null>(null);
  const { companyId } = useUser();

  const onPrint = async () => {
    setBusy("print");
    try {
      const d = await applyCompanyBrandToDoc(await resolveDoc(doc), companyId);
      if (!d?.number && !d?.title) {
        throw new Error("Document data is empty");
      }
      printDocument(d);
      toast.success("Print dialog opened — choose printer or Save as PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed");
    } finally {
      setBusy(null);
    }
  };

  const onHtml = async () => {
    setBusy("html");
    try {
      const d = await applyCompanyBrandToDoc(await resolveDoc(doc), companyId);
      downloadDocumentHtml(d);
      toast.success("HTML downloaded — open file, then Ctrl+P to print/PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const onCsv = async () => {
    setBusy("csv");
    try {
      const d = await resolveDoc(doc);
      downloadDocumentCsv(d);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={
        className
          ? `inline-flex items-center gap-1 ${className}`
          : "inline-flex items-center gap-1"
      }
    >
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={onPrint}
        disabled={busy !== null}
        title="Print / Save as PDF"
      >
        {busy === "print" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-1">Print</span>}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size={size} variant={variant} disabled={busy !== null}>
            <MoreHorizontal className="h-4 w-4" />
            {showLabel && <span className="ml-1">Export</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onHtml}>
            <Download className="h-4 w-4 mr-2" />
            Download HTML (then print)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
