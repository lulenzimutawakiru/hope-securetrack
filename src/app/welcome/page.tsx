"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Menu,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  WELCOME_GROUPS,
  WELCOME_STEP_KEYS,
  WELCOME_STEP_MAP,
  nextStepKey,
  prevStepKey,
  type AssistantMessage,
  type WelcomeState,
  type WelcomeStatus,
  type WelcomeStepKey,
} from "@/lib/platform/welcome";
import type { StepProps, WelcomeData } from "./components/step-types";
import { iconByName } from "./components/icon-map";
import { WelcomeIntroStep } from "./components/steps/welcome-intro";
import { OrganizationStep } from "./components/steps/organization";
import { SubscriptionStep } from "./components/steps/subscription";
import { StructureStep } from "./components/steps/structure";
import { SecurityStep } from "./components/steps/security";
import { ModulesStep } from "./components/steps/modules";
import { BusinessStep } from "./components/steps/business";
import { ImportStep } from "./components/steps/import";
import { IntegrationsStep } from "./components/steps/integrations";
import { AiStep } from "./components/steps/ai";
import { TrainingStep } from "./components/steps/training";
import { ReadinessStep } from "./components/steps/readiness";
import { GoLiveStep } from "./components/steps/go-live";
import { SuccessStep } from "./components/steps/success";

type PatchPayload = {
  current_step?: WelcomeStepKey;
  status?: WelcomeStatus;
  answers?: Record<string, unknown>;
  selections?: Record<string, unknown>;
  step_status?: { key: string; status: "pending" | "in_progress" | "completed" | "skipped" };
  action?: "start" | "complete" | "apply_modules" | "schedule_later" | "reset_step";
};

/** Minimal **bold** renderer for assistant replies. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

function StepRail({
  currentStep,
  stepsProgress,
  onNavigate,
  className,
}: {
  currentStep: WelcomeStepKey;
  stepsProgress: WelcomeState["steps_progress"];
  onNavigate: (key: WelcomeStepKey) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Setup steps" className={className}>
      {WELCOME_GROUPS.map((group) => (
        <div key={group.key}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.steps.map((step) => {
              const active = step.key === currentStep;
              const status = stepsProgress[step.key]?.status ?? "pending";
              const Icon = iconByName(step.icon);
              return (
                <button
                  key={step.key}
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => onNavigate(step.key)}
                  disabled={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-default",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{step.shortLabel}</span>
                  {status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : status === "skipped" ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  ) : active ? (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const { auth, loading: authLoading } = useUser();

  const [data, setData] = useState<WelcomeData | null>(null);
  const dataRef = useRef<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [guardState, setGuardState] = useState<"loading" | "ready" | "redirecting">("loading");
  const [railOpen, setRailOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantSuggestions, setAssistantSuggestions] = useState<string[]>([]);

  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const appliedDeepLinkRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const setDataSafe = useCallback((next: WelcomeData | null) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const sendSave = useCallback(
    async (payload: PatchPayload, opts?: { silent?: boolean }) => {
      if (savingRef.current) {
        pendingSaveRef.current = true;
        return;
      }
      savingRef.current = true;
      if (!opts?.silent) setSaving(true);
      try {
        const res = await fetch("/api/v2/welcome", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `Save failed (${res.status})`);
        }
        const next = json.data ?? json;
        if (next?.state) {
          const local = dataRef.current;
          if (local && dirtyRef.current) {
            // Preserve edits made after this request was sent; the next
            // debounced save persists them and refreshes the scores.
            next.state.answers = local.state.answers;
            next.state.selections = local.state.selections;
          } else {
            dirtyRef.current = false;
            setLastSavedAt(Date.now());
          }
          setDataSafe(next);
          const msgs = next.state.assistant?.messages;
          if (msgs && msgs.length > 0) setAssistantMessages(msgs);
        }
      } catch (e) {
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : "Failed to save your progress");
        }
      } finally {
        savingRef.current = false;
        if (!opts?.silent) setSaving(false);
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          const cur = dataRef.current;
          if (cur) {
            void sendSave(
              {
                current_step: cur.state.current_step,
                answers: cur.state.answers,
                selections: cur.state.selections,
              },
              { silent: true }
            );
          }
        }
      }
    },
    [setDataSafe]
  );

  const scheduleSave = useCallback(
    (delay = 500) => {
      clearTimer();
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const cur = dataRef.current;
        if (!cur) return;
        void sendSave({
          current_step: cur.state.current_step,
          answers: cur.state.answers,
          selections: cur.state.selections,
        });
      }, delay);
    },
    [clearTimer, sendSave]
  );

  const flushSave = useCallback(() => {
    clearTimer();
    if (!dirtyRef.current) return;
    const cur = dataRef.current;
    if (!cur) return;
    void sendSave({
      current_step: cur.state.current_step,
      answers: cur.state.answers,
      selections: cur.state.selections,
    });
  }, [clearTimer, sendSave]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/v2/welcome", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Failed to load (${res.status})`);
      }
      const d = json.data ?? json;
      if (!d?.state) throw new Error("Unexpected welcome payload");
      setDataSafe(d);
      setAssistantMessages(d.state.assistant?.messages ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load your onboarding state");
    } finally {
      setLoading(false);
    }
  }, [setDataSafe]);

  // Auth guard: the wizard only runs inside a tenant workspace.
  useEffect(() => {
    if (authLoading) return;
    if (!auth) {
      setGuardState("redirecting");
      router.replace("/login");
      return;
    }
    const tenantId = (auth?.profile as { tenant_id?: string | null } | undefined)?.tenant_id;
    if (!tenantId) {
      setGuardState("redirecting");
      router.replace("/dashboard");
      return;
    }
    setGuardState("ready");
  }, [auth, authLoading, router]);

  // Initial load
  useEffect(() => {
    if (guardState !== "ready") return;
    void load();
  }, [guardState, load]);

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Flush pending edits when the tab is hidden
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flushSave]);

  // Auto-scroll assistant messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantMessages, assistantBusy]);

  const updateLocal = useCallback(
    (patch: Partial<WelcomeState>) => {
      const cur = dataRef.current;
      if (!cur) return;
      submitRef.current = null;
      setDataSafe({ ...cur, state: { ...cur.state, ...patch } });
    },
    [setDataSafe]
  );

  const patchAnswers = useCallback(
    (patch: Record<string, unknown>) => {
      const cur = dataRef.current;
      if (!cur) return;
      const key = cur.state.current_step;
      const base = (cur.state.answers?.[key] as Record<string, unknown> | undefined) ?? {};
      dirtyRef.current = true;
      setDataSafe({
        ...cur,
        state: {
          ...cur.state,
          answers: { ...(cur.state.answers ?? {}), [key]: { ...base, ...patch } },
        },
      });
      scheduleSave(500);
    },
    [scheduleSave, setDataSafe]
  );

  const patchSelections = useCallback(
    (patch: Record<string, unknown>) => {
      const cur = dataRef.current;
      if (!cur) return;
      const key = cur.state.current_step;
      const base = (cur.state.selections?.[key] as Record<string, unknown> | undefined) ?? {};
      dirtyRef.current = true;
      setDataSafe({
        ...cur,
        state: {
          ...cur.state,
          selections: { ...(cur.state.selections ?? {}), [key]: { ...base, ...patch } },
        },
      });
      scheduleSave(500);
    },
    [scheduleSave, setDataSafe]
  );

  const goTo = useCallback(
    (key: WelcomeStepKey) => {
      const cur = dataRef.current;
      if (!cur || cur.state.current_step === key) return;
      clearTimer();
      const payload: PatchPayload = { current_step: key };
      if (dirtyRef.current) {
        payload.answers = cur.state.answers;
        payload.selections = cur.state.selections;
      }
      updateLocal({ current_step: key });
      void sendSave(payload);
      setRailOpen(false);
    },
    [clearTimer, sendSave, updateLocal]
  );

  // Deep link support: /welcome?step=modules
  useEffect(() => {
    if (guardState !== "ready" || appliedDeepLinkRef.current) return;
    const cur = dataRef.current;
    if (!cur || cur.state.status === "completed") return;
    const stepParam = new URLSearchParams(window.location.search).get("step") as
      | WelcomeStepKey
      | null;
    if (stepParam && WELCOME_STEP_KEYS.includes(stepParam) && stepParam !== cur.state.current_step) {
      appliedDeepLinkRef.current = true;
      const t = setTimeout(() => goTo(stepParam), 60);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardState, goTo]);

  const finishStep = useCallback(() => {
    const cur = dataRef.current;
    if (!cur) return;
    clearTimer();
    const key = cur.state.current_step;
    if (key === "success") return;
    const nextKey = nextStepKey(key);
    const now = new Date().toISOString();
    const payload: PatchPayload = {
      current_step: nextKey,
      answers: cur.state.answers,
      selections: cur.state.selections,
      step_status: { key, status: "completed" },
    };
    // Persist the module selection into tenant_modules when the user finishes that step.
    if (key === "modules") payload.action = "apply_modules";
    updateLocal({
      current_step: nextKey,
      steps_progress: {
        ...cur.state.steps_progress,
        [key]: { status: "completed", completed_at: now },
      },
    });
    void sendSave(payload);
  }, [clearTimer, sendSave, updateLocal]);

  const skipStep = useCallback(() => {
    const cur = dataRef.current;
    if (!cur) return;
    clearTimer();
    const key = cur.state.current_step;
    if (key === "success") return;
    const nextKey = nextStepKey(key);
    const now = new Date().toISOString();
    updateLocal({
      current_step: nextKey,
      steps_progress: {
        ...cur.state.steps_progress,
        [key]: { status: "skipped", skipped_at: now },
      },
    });
    void sendSave({
      current_step: nextKey,
      answers: cur.state.answers,
      selections: cur.state.selections,
      step_status: { key, status: "skipped" },
    });
  }, [clearTimer, sendSave, updateLocal]);

  const completeWizard = useCallback(() => {
    clearTimer();
    void sendSave({ action: "complete" });
  }, [clearTimer, sendSave]);

  const goBack = useCallback(() => {
    const cur = dataRef.current;
    if (!cur) return;
    goTo(prevStepKey(cur.state.current_step));
  }, [goTo]);

  const registerSubmit = useCallback((fn: () => void) => {
    submitRef.current = fn;
  }, []);

  const saveNow = useCallback(async () => {
    clearTimer();
    const cur = dataRef.current;
    if (!cur) return;
    await sendSave({
      current_step: cur.state.current_step,
      answers: cur.state.answers,
      selections: cur.state.selections,
    });
  }, [clearTimer, sendSave]);

  const handleContinue = useCallback(() => {
    if (submitRef.current) {
      submitRef.current();
    } else {
      finishStep();
    }
  }, [finishStep]);

  const sendAssistant = useCallback(
    async (text?: string) => {
      const message = (text ?? assistantInput).trim();
      if (assistantBusy) return;
      setAssistantInput("");
      setAssistantBusy(true);
      if (message) {
        setAssistantMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, role: "user", text: message, at: new Date().toISOString() },
        ]);
      }
      try {
        const res = await fetch("/api/v2/welcome/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "Assistant unavailable");
        }
        const d = json.data ?? json;
        setAssistantMessages(d.messages ?? []);
        setAssistantSuggestions(d.suggestions ?? []);
        const cur = dataRef.current;
        if (cur && d.messages) {
          setDataSafe({
            ...cur,
            state: {
              ...cur.state,
              assistant: { ...(cur.state.assistant ?? {}), messages: d.messages },
            },
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Assistant unavailable right now");
        if (message) {
          setAssistantMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              text: "I couldn't reach the assistant just now. Please try again in a moment.",
              at: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setAssistantBusy(false);
      }
    },
    [assistantBusy, assistantInput, setDataSafe]
  );

  const openAssistant = useCallback(() => {
    setAssistantOpen(true);
    if (assistantMessages.length === 0 && !assistantBusy) {
      void sendAssistant();
    }
  }, [assistantMessages.length, assistantBusy, sendAssistant]);

  const currentStep = data?.state.current_step ?? "welcome";
  const currentDef = WELCOME_STEP_MAP[currentStep];

  const requiredSteps = useMemo(
    () => (data ? data.steps.filter((s) => s.required !== false && s.key !== "success") : []),
    [data]
  );
  const doneCount = useMemo(
    () =>
      requiredSteps.filter((s) => {
        const p = data?.state.steps_progress[s.key];
        return p?.status === "completed" || p?.status === "skipped";
      }).length,
    [requiredSteps, data]
  );
  const percent =
    data?.progress ?? (requiredSteps.length ? Math.round((doneCount / requiredSteps.length) * 100) : 0);

  const canSkip =
    currentDef &&
    !currentDef.required &&
    !currentDef.autoComplete &&
    currentStep !== "welcome" &&
    currentStep !== "success";

  const renderStep = () => {
    if (!data) return null;
    const stepProps: StepProps = {
      data,
      saving,
      value: (data.state.answers?.[currentStep] as Record<string, unknown>) ?? {},
      selection: (data.state.selections?.[currentStep] as Record<string, unknown>) ?? {},
      onPatchAnswers: patchAnswers,
      onPatchSelections: patchSelections,
      onComplete: completeWizard,
      onNext: finishStep,
      onBack: goBack,
      goTo,
      registerSubmit,
      finishStep,
      skipStep,
      saveNow,
    };
    switch (currentStep) {
      case "welcome":
        return <WelcomeIntroStep {...stepProps} />;
      case "organization":
        return <OrganizationStep {...stepProps} />;
      case "subscription":
        return <SubscriptionStep {...stepProps} />;
      case "structure":
        return <StructureStep {...stepProps} />;
      case "security":
        return <SecurityStep {...stepProps} />;
      case "modules":
        return <ModulesStep {...stepProps} />;
      case "business":
        return <BusinessStep {...stepProps} />;
      case "import":
        return <ImportStep {...stepProps} />;
      case "integrations":
        return <IntegrationsStep {...stepProps} />;
      case "ai":
        return <AiStep {...stepProps} />;
      case "training":
        return <TrainingStep {...stepProps} />;
      case "readiness":
        return <ReadinessStep {...stepProps} />;
      case "go_live":
        return <GoLiveStep {...stepProps} />;
      case "success":
        return <SuccessStep {...stepProps} />;
      default:
        return <WelcomeIntroStep {...stepProps} />;
    }
  };

  if (guardState !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open setup steps"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setRailOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold tracking-tight">SecureTrack ERP</span>
              <span className="text-[11px] text-muted-foreground">Welcome &amp; Setup</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "hidden items-center gap-1.5 text-xs md:inline-flex",
                saving ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : lastSavedAt ? (
                <>
                  <Save className="h-3.5 w-3.5" /> All changes saved
                </>
              ) : null}
            </span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openAssistant}>
              <Bot className="h-4 w-4 text-primary" /> AI Assistant
            </Button>
          </div>
        </div>
        <div className="border-t px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>{percent}% configured</span>
            <span>
              {doneCount} of {requiredSteps.length} required steps
            </span>
          </div>
          <Progress value={percent} className="mt-1.5 h-1.5" />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* Desktop rail */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <StepRail
            currentStep={currentStep}
            stepsProgress={data?.state.steps_progress ?? {}}
            onNavigate={goTo}
            className="sticky top-32 max-h-[calc(100vh-9rem)] space-y-5 overflow-y-auto rounded-2xl border bg-card p-3"
          />
        </aside>

        {/* Mobile rail */}
        <Sheet open={railOpen} onOpenChange={setRailOpen}>
          <SheetContent side="left" className="w-80 overflow-y-auto p-4 sm:max-w-xs">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Setup steps
              </SheetTitle>
              <SheetDescription>
                Jump to any part of your setup — progress is saved automatically.
              </SheetDescription>
            </SheetHeader>
            <StepRail
              currentStep={currentStep}
              stepsProgress={data?.state.steps_progress ?? {}}
              onNavigate={goTo}
              className="space-y-5"
            />
          </SheetContent>
        </Sheet>

        {/* Step content */}
        <main className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-40 w-full rounded-3xl" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            </div>
          ) : loadError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <X className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold">We couldn&apos;t load your setup</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void load()}>Try again</Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Back to dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : data ? (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              {/* Footer nav */}
              <div className="mt-8 flex items-center justify-between gap-3 border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={currentStep === "welcome" || currentStep === "success"}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  {canSkip ? (
                    <Button variant="ghost" size="sm" onClick={skipStep}>
                      Skip for now
                    </Button>
                  ) : null}
                  {currentStep !== "welcome" && currentStep !== "success" ? (
                    <Button size="sm" onClick={handleContinue}>
                      Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      {/* Mobile assistant launcher */}
      <button
        type="button"
        aria-label="Open AI assistant"
        onClick={openAssistant}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* AI assistant */}
      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              AI Welcome Assistant
            </SheetTitle>
            <SheetDescription>
              Tenant-scoped guidance
              {data?.summary?.organization_name ? ` for ${data.summary.organization_name}` : ""} —
              nothing leaves your workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {assistantMessages.length === 0 && !assistantBusy ? (
              <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Ask me anything about your setup — modules, security, data import or go-live.
              </div>
            ) : (
              assistantMessages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border bg-card text-foreground"
                    )}
                  >
                    <RichText text={m.text} />
                  </div>
                </div>
              ))
            )}
            {assistantBusy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
          {assistantSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5">
              {assistantSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendAssistant(s)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendAssistant();
            }}
          >
            <input
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              placeholder="Ask about setup, modules, security…"
              aria-label="Ask the AI assistant"
              className="h-10 w-full rounded-xl border border-input bg-transparent px-3.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={assistantBusy} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}