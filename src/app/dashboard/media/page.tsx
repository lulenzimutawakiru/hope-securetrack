"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, FileIcon, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { useUser } from "@/hooks/use-user";
import { listMediaFiles, deleteFile, formatBytes, STORAGE_BUCKETS } from "@/lib/storage";
import type { StorageBucket } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function MediaLibraryPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<StorageBucket>("attachments");

  const load = async () => {
    if (!auth?.profile?.company_id) {
      setLoading(false);
      return;
    }
    try {
      const data = await listMediaFiles({
        companyId: auth.profile.company_id,
        category: category === "all" ? undefined : category,
        limit: 200,
      });
      setRows(data as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed — apply media migration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [auth, category]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      String(r.original_name || "").toLowerCase().includes(s) ||
      String(r.file_name || "").toLowerCase().includes(s) ||
      String(r.category || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading media library…" />;

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Logos · avatars · documents · attachments · images · company branding files"
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-1 space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Upload to bucket</p>
            <Select value={bucket} onValueChange={(v) => setBucket(v as StorageBucket)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(STORAGE_BUCKETS).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FileUpload
            bucket={bucket}
            category={
              bucket === "avatars"
                ? "avatar"
                : bucket === "logos"
                  ? "logo"
                  : bucket === "documents"
                    ? "document"
                    : bucket === "media"
                      ? "media"
                      : "attachment"
            }
            folder="library"
            preview={bucket === "avatars" || bucket === "logos" || bucket === "branding" || bucket === "media"}
            label="Upload file"
            hint="Drag & drop or click to browse"
            onUploaded={() => load()}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              className="max-w-xs"
              placeholder="Search files…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "avatar", "logo", "seal", "watermark", "document", "attachment", "media", "branding", "photo"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => load()}>
              <Upload className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No media files"
              description="Upload logos, profile photos, PDFs, or attachments."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const url = String(r.public_url || "");
                    const isImg = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
                    return (
                      <TableRow key={r.id as string}>
                        <TableCell>
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="h-10 w-10 object-cover rounded border" />
                          ) : (
                            <FileIcon className="h-8 w-8 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px]">
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary underline truncate block">
                            {String(r.original_name || r.file_name)}
                          </a>
                        </TableCell>
                        <TableCell><Badge variant="outline">{String(r.category)}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{String(r.bucket_id)}</TableCell>
                        <TableCell className="text-xs">{formatBytes(Number(r.file_size_bytes || 0))}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(r.created_at))}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!confirm("Delete this file?")) return;
                              try {
                                await deleteFile(
                                  String(r.bucket_id),
                                  String(r.storage_path),
                                  r.id as string
                                );
                                toast.success("Deleted");
                                load();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Delete failed");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
