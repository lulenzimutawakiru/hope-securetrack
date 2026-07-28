"use client";

import { Printer, Download, FileSpreadsheet, MoreHorizontal } from "lucide-react";
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
  const onPrint = async () => {
    try {
      const d = await resolveDoc(doc);
      printDocument(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed");
    }
  };

  const onHtml = async () => {
    try {
      const d = await resolveDoc(doc);
      downloadDocumentHtml(d);
      toast.success("Document downloaded (open & Print → Save as PDF)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const onCsv = async () => {
    try {
      const d = await resolveDoc(doc);
      downloadDocumentCsv(d);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className={className ? `inline-flex items-center gap-1 ${className}` : "inline-flex items-center gap-1"}>
      <Button type="button" size={size} variant={variant} onClick={onPrint}>
        <Printer className="h-4 w-4" />
        {showLabel && <span className="ml-1">Print</span>}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size={size} variant={variant}>
            <MoreHorizontal className="h-4 w-4" />
            {showLabel && <span className="ml-1">Export</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onHtml}>
            <Download className="h-4 w-4 mr-2" />
            Download HTML / PDF-ready
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
