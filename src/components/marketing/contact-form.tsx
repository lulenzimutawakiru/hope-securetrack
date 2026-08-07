"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(150),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(255),
  company: z.string().trim().max(150).optional(),
  industry: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (10+ characters).")
    .max(8000),
});

type ContactValues = z.infer<typeof contactSchema>;

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      industry: "",
      country: "",
      message: "",
    },
  });

  async function onSubmit(values: ContactValues) {
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          company: values.company || null,
          industry: values.industry || null,
          country: values.country || null,
          message: values.message,
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
    } catch {
      setStatus("error");
      setError("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-lg font-bold">Message sent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you — our team will get back to you within one business day.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setStatus("idle")}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full name *</Label>
          <Input
            id="name"
            placeholder="Jane Doe"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@company.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" placeholder="Acme Corp" {...register("company")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            placeholder="Manufacturing"
            {...register("industry")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">How can we help? *</Label>
        <Textarea
          id="message"
          rows={5}
          placeholder="Tell us about your business and goals..."
          aria-invalid={!!errors.message}
          {...register("message")}
        />
        {errors.message ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.message.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
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
        By submitting, you agree to our{" "}
        <a href="/legal/privacy" className="underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/legal/terms" className="underline">
          Terms
        </a>
        .
      </p>
    </form>
  );
}