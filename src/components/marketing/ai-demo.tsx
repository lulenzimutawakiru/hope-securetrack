"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CornerDownLeft, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "ai"; text: string };

const SUGGESTIONS: Array<{ id: string; label: string; answer: string }> = [
  {
    id: "revenue",
    label: "Show revenue",
    answer: "Revenue for this month is $8.4M, up 12% vs forecast and 18% YoY. East Africa leads with $2.9M; the AI forecast for next quarter is +9% with 87% confidence. Top driver: the Professional plan segment grew 24%.",
  },
  {
    id: "payroll",
    label: "Generate payroll",
    answer: "Payroll run draft ready: 1,284 employees, gross $1.9M, statutory deductions (PAYE, NSSF) computed and filed. 3 exceptions flagged — 2 missing bank details, 1 rate change pending approval. Nothing is posted until you approve.",
  },
  {
    id: "inventory",
    label: "Forecast inventory",
    answer: "Demand forecast for the next 30 days suggests re-ordering 23 SKUs (est. $460K). 14 SKUs risk stockout within 2 weeks — highest priority: RM-2041 (Teal Batch). 12 SKUs are overstocked and flagged for a markdown plan.",
  },
  {
    id: "sales",
    label: "Predict sales",
    answer: "Next-quarter sales are predicted at $12.6M (+9%), driven by 3 large opportunities in the pipeline (combined $3.4M). Win probability is 87% for Phase-2 accounts. Recommended: reallocate 2 reps to the Kampala region for +$420K.",
  },
  {
    id: "executive",
    label: "Generate executive report",
    answer: "Executive summary — August: Revenue $8.4M (+12%), net margin 21.4% (+1.8pts), cash $3.1M. Highlights: manufacturing OEE at 87%, DSO down 4 days, and AI flagged one duplicate-payment risk (held for review). Risks: 4 projects at schedule risk; mitigation plans attached.",
  },
  {
    id: "unpaid",
    label: "Show unpaid invoices",
    answer: "214 unpaid invoices totaling $1.2M. 86 are overdue (30+ days): 12 are flagged by AI as high risk based on payment history. Suggested actions: send automated reminders to 74, escalate 9 to collections, and offer early-payment discount to 3 strategic accounts.",
  },
];

export function AiDemo() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Welcome! I’m your SecureTrack AI assistant. Ask me anything about your enterprise — try a suggestion below.",
    },
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [current, setCurrent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, current, typing]);

  const ask = (s: { id: string; label: string; answer: string }) => {
    if (typing) return;
    setMessages((m) => [...m, { role: "user", text: s.label }]);
    setActiveId(s.id);
    setTyping(true);
    setCurrent("");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setCurrent(s.answer.slice(0, i));
      if (i >= s.answer.length) {
        clearInterval(timer);
        setTyping(false);
        setMessages((m) => [...m, { role: "ai", text: s.answer }]);
        setCurrent("");
        setActiveId(null);
      }
    }, 12);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hope-blue/10 text-hope-blue">
            <Bot className="h-4.5 w-4.5 h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <div className="text-sm font-semibold">SecureTrack AI</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Online · tenant-isolated
            </div>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Interactive demo
        </span>
      </div>

      <div ref={scrollRef} className="h-[320px] space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "ai" ? (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-hope-blue/10 text-hope-blue">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <div
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-hope-blue text-white"
                  : "rounded-bl-md border border-border bg-muted/60",
              )}
            >
              {m.text}
            </div>
            {m.role === "user" ? (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        ))}
        {typing ? (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-hope-blue/10 text-hope-blue">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-border bg-muted/60 px-4 py-2.5 text-sm leading-relaxed">
              {current}
              <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-hope-blue align-middle" aria-hidden="true" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border p-4">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={typing}
              onClick={() => ask(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-foreground transition hover:border-hope-blue/40 hover:bg-hope-blue/10 disabled:opacity-50",
                activeId === s.id && "border-hope-blue/50 bg-hope-blue/10",
              )}
            >
              {s.label}
              <CornerDownLeft className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Demo responses are illustrative. In your tenant, AI answers from your own data with permission-aware, explainable results.
        </p>
      </div>
    </div>
  );
}
