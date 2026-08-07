"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  COUNTRY_OPTIONS,
} from "@/lib/marketing/lead-options";
import { TurnstileWidget } from "@/components/security/turnstile";

const TURNSTILE_SITE_KEY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    : "";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(150),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(255),
  company: z.string().trim().min(2, "Please enter your company name.").max(150),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => !v || /^[+0-9][0-9\s().-]{5,39}$/.test(v), {
      message: "Enter a valid phone number (e.g. +256 700 000 000).",
    })
    .optional()
    .or(z.literal("")),
  industry: z.string().min(1, "Please select your industry."),
  companySize: z.string().optional(),
  country: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (10+ characters).")
    .max(8000),
  website: z.string().max(200).optional(),
});

type ContactValues = z.infer<typeof contactSchema>;

type Status = "idle" | "submitting" | "success" | "error";

const ACCEPT =
  "application/pdf,.doc,.docx,.xls,.xlsx,text/plain,text/csv,image/jpeg,image/png,image/webp";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const startedAtRef = useRef<number>(Date.now());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      industry: "",
      companySize: "",
      country: "UG",
      preferredContactMethod: "email",
      message: "",
      website: "",
    },
  });

  const industry = watch("industry");
  const companySize = watch("companySize");
  const country = watch("country");
  const method = watch("preferredContactMethod");

  async function uploadAttachment(fileToUpload: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", fileToUpload);
    const res = await fetch("/api/public/contact/upload", { method: "POST", body: fd });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: { path?: string };
      error?: string;
    };
    if (!res.ok || !payload.ok || !payload.data?.path) {
      throw new Error(payload.error || "File upload failed. Please try again.");
    }
    return payload.data.path;
  }

  async function onSubmit(values: ContactValues) {
    setStatus("submitting");
    setError("");
    setFileError("");
    try {
      let attachmentPath: string | null = null;
      if (file) {
        attachmentPath = await uploadAttachment(file);
      }

      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          company: values.company,
          phone: values.phone || null,
          industry: values.industry,
          companySize: values.companySize || null,
          country: values.country || null,
          preferredContactMethod: values.preferredContactMethod || null,
          message: values.message,
          attachmentPath,
          website: values.website || "",
          startedAt: startedAtRef.current,
          turnstileToken: TURNSTILE_SITE_KEY ? turnstileToken : null,
          utmSource:
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("utm_source")
              : null,
          utmMedium:
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("utm_medium")
              : null,
          utmCampaign:
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("utm_campaign")
              : null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(
          payload.error ||
            (res.status === 429
              ? "Too many messages right now. Please try again later."
              : "Something went wrong. Please try again.")
        );
        setStatus("error");
        return;
      }
      setStatus("success");
      reset();
      setFile(null);
      setTurnstileToken("");
      startedAtRef.current = Date.now();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-lg font-bold">Thank you for contacting us</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Our enterprise solutions team will respond within 24 hours.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  const field = (key: keyof ContactValues) => (errors[key]?.message as string) || undefined;

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Honeypot: hidden from humans, filled by bots */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          placeholder="Leave this field empty"
          {...register("website")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full name *</Label>
          <Input
            id="name"
            placeholder="John Smith"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {field("name") ? (
            <p className="text-xs text-destructive" role="alert">{field("name")}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@company.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {field("email") ? (
            <p className="text-xs text-destructive" role="alert">{field("email")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company name *</Label>
          <Input
            id="company"
            placeholder="Your Company Name"
            autoComplete="organization"
            aria-invalid={!!errors.company}
            {...register("company")}
          />
          {field("company") ? (
            <p className="text-xs text-destructive" role="alert">{field("company")}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+256 XXX XXX XXX"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          {field("phone") ? (
            <p className="text-xs text-destructive" role="alert">{field("phone")}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Industry *</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Industry">
          {INDUSTRY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={industry === option}
              onClick={() => setValue("industry", option, { shouldValidate: true })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                industry === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {option}
            </button>
          ))}
        </div>
        {field("industry") ? (
          <p className="text-xs text-destructive" role="alert">{field("industry")}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companySize">Company size</Label>
          <Select
            value={companySize || undefined}
            onValueChange={(v) => setValue("companySize", v, { shouldValidate: true })}
          >
            <SelectTrigger id="companySize" className="w-full">
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select
            value={country || undefined}
            onValueChange={(v) => setValue("country", v, { shouldValidate: true })}
          >
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name} ({c.dial})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">What can we help you with? *</Label>
        <Textarea
          id="message"
          rows={5}
          placeholder="Tell us about your business challenges, goals, and the solutions you are looking for..."
          aria-invalid={!!errors.message}
          {...register("message")}
        />
        {field("message") ? (
          <p className="text-xs text-destructive" role="alert">{field("message")}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Preferred contact method</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred contact method">
          {CONTACT_METHOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={method === option.value}
              onClick={() =>
                setValue("preferredContactMethod", option.value, { shouldValidate: true })
              }
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                method === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="attachment">Attach document (optional)</Label>
        <div className="flex items-center gap-3">
          <label
            htmlFor="attachment"
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2.5 text-sm font-medium transition-colors",
              file
                ? "border-green-500/50 bg-green-500/5 text-green-700"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {file ? (
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            )}
            {file ? file.name : "Upload file"}
            <span className="text-xs opacity-70">(max 3 MB)</span>
          </label>
          <input
            id="attachment"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFileError("");
              if (!f) {
                setFile(null);
                return;
              }
              if (f.size > 3 * 1024 * 1024) {
                setFileError("File must be smaller than 3 MB.");
                setFile(null);
                e.target.value = "";
                return;
              }
              setFile(f);
            }}
          />
          {file ? (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                const el = document.getElementById("attachment") as HTMLInputElement | null;
                if (el) el.value = "";
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              aria-label="Remove attachment"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
            </button>
          ) : null}
        </div>
        {fileError ? (
          <p className="text-xs text-destructive" role="alert">{fileError}</p>
        ) : null}
      </div>

      {TURNSTILE_SITE_KEY ? (
        <div className="flex justify-center">
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
          />
          {!turnstileToken ? (
            <p className="mt-1 text-xs text-muted-foreground" role="alert">
              Please complete the security check.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={status === "submitting" || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            Send message
          </>
        )}
      </Button>

      {status === "error" ? (
        <p
          className="flex items-center justify-center gap-2 text-center text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        By submitting this form, you agree to our{" "}
        <a href="/legal/privacy" className="underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/legal/terms" className="underline">
          Terms of Service
        </a>
        .
      </p>
    </form>
  );
}