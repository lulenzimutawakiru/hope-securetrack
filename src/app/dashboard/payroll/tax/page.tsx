"use client";

import { useEffect, useState } from "react";
import { Receipt, Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import { COUNTRIES, calculateEmployeePay } from "@/lib/payroll";

export default function PayTaxPage() {
  const [brackets, setBrackets] = useState<Array<Record<string, unknown>>>([]);
  const [rates, setRates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("UG");
  const [sampleGross, setSampleGross] = useState("1500000");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [{ data: b }, { data: r }] = await Promise.all([
        sb.from("pay_tax_brackets").select("*").eq("is_active", true).order("sort_order"),
        sb.from("pay_statutory_rates").select("*").eq("is_active", true),
      ]);
      setBrackets((b as Array<Record<string, unknown>>) || []);
      setRates((r as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading tax rules…" />;

  const countryBrackets = brackets.filter((b) => b.country_code === country);
  const countryRates = rates.filter((r) => r.country_code === country);
  const gross = Number(sampleGross) || 0;
  const calc = calculateEmployeePay(
    {
      employee_id: "demo",
      basic_salary: gross,
      country_code: country,
    },
    { country }
  );

  return (
    <div>
      <PageHeader
        title="Tax & Statutory"
        description="PAYE brackets · NSSF · NHIF · multi-country compliance"
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div>
          <Label>Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label} ({c.currency})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sample monthly gross (calculator)</Label>
          <Input type="number" value={sampleGross} onChange={(e) => setSampleGross(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Live calc
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Gross</span><span>{formatNumber(calc.gross_pay)}</span></div>
            <div className="flex justify-between"><span>PAYE</span><span>{formatNumber(calc.paye)}</span></div>
            <div className="flex justify-between"><span>NSSF EE</span><span>{formatNumber(calc.nssf_employee)}</span></div>
            <div className="flex justify-between"><span>NSSF ER</span><span>{formatNumber(calc.nssf_employer)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>Net</span><span>{formatNumber(calc.net_pay)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Employer cost</span><span>{formatNumber(calc.employer_cost)}</span></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> PAYE brackets ({country})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countryBrackets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Using built-in defaults (apply migration 00034 for DB brackets).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bracket</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Max</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Fixed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countryBrackets.map((b) => (
                    <TableRow key={String(b.id)}>
                      <TableCell className="text-sm">{String(b.bracket_name)}</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(Number(b.min_amount))}</TableCell>
                      <TableCell className="text-right text-sm">
                        {b.max_amount == null ? "∞" : formatNumber(Number(b.max_amount))}
                      </TableCell>
                      <TableCell className="text-right text-sm">{String(b.rate_pct)}%</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(Number(b.fixed_amount || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statutory rates ({country})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {countryRates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No DB rates — engine uses defaults.</p>
            ) : (
              countryRates.map((r) => (
                <Badge key={String(r.id)} variant="outline" className="text-xs py-1 px-2">
                  {String(r.name)} · {String(r.rate_pct)}%
                  {r.employer_portion ? " (employer)" : ""}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
