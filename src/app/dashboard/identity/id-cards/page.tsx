"use client";

import { useEffect, useState } from "react";
import { IdCard, Printer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listIdCards,
  issueIdCard,
  printIdCard,
  listPersonsByLifecycle,
  CARD_TEMPLATES,
  getDigitalIdentityStats,
} from "@/lib/digital-identity";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function IdCardsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Array<Record<string, unknown>>>([]);
  const [persons, setPersons] = useState<Array<Record<string, unknown>>>([]);
  const [personId, setPersonId] = useState("");
  const [cardType, setCardType] = useState("staff");
  const [activeCards, setActiveCards] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [c, p, s] = await Promise.all([
        listIdCards({ limit: 100 }),
        listPersonsByLifecycle({ limit: 200 }),
        getDigitalIdentityStats(),
      ]);
      setCards(c as Array<Record<string, unknown>>);
      setPersons(p as Array<Record<string, unknown>>);
      setActiveCards(s.activeCards);
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const issue = async () => {
    if (!auth || !personId) {
      toast.error("Select a person");
      return;
    }
    setBusy(true);
    try {
      const card = await issueIdCard({
        company_id: auth.profile.company_id,
        person_id: personId,
        card_type: cardType,
        actor_id: auth.user.id,
      });
      toast.success(`Issued ${card.card_number}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  };

  const doPrint = async (id: string) => {
    try {
      await printIdCard(id);
      toast.success("Print dialog opened");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed");
    }
  };

  if (loading) return <LoadingState message="Loading company ID cards…" />;

  return (
    <div>
      <PageHeader
        title="Digital Company ID Management"
        description="Photo · logo · QR · barcode · blood group · emergency · batch print · reissue"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id as string} value={p.id as string}>
                    {String(p.display_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARD_TEMPLATES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={issue} disabled={busy}>
              <IdCard className="h-4 w-4 mr-1" /> Issue card
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Active cards" value={String(activeCards)} icon={IdCard} />
        <StatCard title="Total records" value={String(cards.length)} icon={Printer} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {CARD_TEMPLATES.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState title="No ID cards issued" description="Issue a staff, contractor, or visitor card." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card #</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prints</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => {
                const person = c.uw_persons as Record<string, unknown> | null;
                return (
                  <TableRow key={c.id as string}>
                    <TableCell className="font-mono text-xs">{String(c.card_number)}</TableCell>
                    <TableCell className="text-sm">
                      {person ? String(person.display_name) : "—"}
                      {person?.upid != null && String(person.upid) !== "" && (
                        <span className="block text-[10px] font-mono text-muted-foreground">
                          {String(person.upid)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(c.card_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(String(c.issue_date))}</TableCell>
                    <TableCell className="text-xs">{formatDate(String(c.expiry_date))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>
                        {String(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{String(c.print_count ?? 0)}</TableCell>
                    <TableCell className="space-x-1">
                      {c.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => doPrint(c.id as string)}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!auth) return;
                              await issueIdCard({
                                company_id: auth.profile.company_id,
                                person_id: c.person_id as string,
                                card_type: String(c.card_type),
                                actor_id: auth.user.id,
                              });
                              toast.success("Reissued");
                              load();
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview card mock */}
      <Card className="mt-6 max-w-md bg-gradient-to-br from-hope-navy to-[#0d2847] text-white">
        <CardContent className="p-6">
          <p className="text-hope-gold text-[10px] font-semibold uppercase tracking-widest mb-3">
            Company ID · Front preview
          </p>
          <div className="flex gap-4">
            <div className="h-20 w-16 rounded bg-white/10 flex items-center justify-center text-xs">
              Photo
            </div>
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">Employee Name</p>
              <p className="text-white/70 text-xs">Position · Department</p>
              <p className="font-mono text-[11px] text-hope-gold">EMP / UPID</p>
              <p className="text-[10px] text-white/50">Blood · Branch · QR</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
