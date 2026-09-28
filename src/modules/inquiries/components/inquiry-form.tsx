"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/form/form-select";
import { submitInquiryAction } from "../actions";
import {
  INQUIRY_BUDGETS,
  INQUIRY_LIMITS,
  inquiryInputSchema,
  type InquiryInput,
} from "../schema";
import { TurnstileWidget, type TurnstileHandle } from "./turnstile-widget";

const FIELD_ERRORS = ["required", "tooShort", "tooLong", "invalidEmail"] as const;

// The public sponsor inquiry form. Validation runs here for feedback and
// again on the server, which also checks the honeypot, the rate limit and
// Turnstile (src/modules/inquiries/actions.ts).
export function InquiryForm({
  siteKey,
  action,
  nonce,
}: {
  siteKey: string;
  action: string;
  nonce?: string;
}) {
  const t = useTranslations("Inquiry");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [widgetError, setWidgetError] = useState(false);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const form = useForm<InquiryInput>({
    resolver: zodResolver(inquiryInputSchema),
    defaultValues: { company: "", contactName: "", email: "", budget: undefined, message: "" },
  });
  const { errors } = form.formState;
  const message = useWatch({ control: form.control, name: "message" }) ?? "";

  const errorFor = (code: string | undefined) =>
    code && (FIELD_ERRORS as readonly string[]).includes(code)
      ? [{ message: t(`errors.${code as (typeof FIELD_ERRORS)[number]}`) }]
      : undefined;

  function onSubmit(values: InquiryInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await submitInquiryAction(
        values,
        token,
        honeypot.current?.value ?? "",
        locale,
      );
      // Tokens are single-use: always get a fresh one for the next attempt.
      turnstile.current?.reset();
      if (result.ok) {
        form.reset();
        setSent(true);
      } else {
        setFormError(t(`errors.${result.error}`));
      }
    });
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border bg-background/60 p-fluid">
        <CheckCircle2 className="size-8 text-brand-text" aria-hidden />
        <p className="text-fluid-lg font-semibold">{t("successTitle")}</p>
        <p className="text-muted-foreground">{t("successText")}</p>
        <Button type="button" variant="outline" onClick={() => setSent(false)}>
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => form.handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.company}>
            <FieldLabel htmlFor="company">{t("company")}</FieldLabel>
            <Input id="company" autoComplete="organization" aria-invalid={!!errors.company} {...form.register("company")} />
            <FieldError errors={errorFor(errors.company?.message)} />
          </Field>
          <Field data-invalid={!!errors.contactName}>
            <FieldLabel htmlFor="contactName">{t("contactName")}</FieldLabel>
            <Input id="contactName" autoComplete="name" aria-invalid={!!errors.contactName} {...form.register("contactName")} />
            <FieldError errors={errorFor(errors.contactName?.message)} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError errors={errorFor(errors.email?.message)} />
          </Field>
          <Field data-invalid={!!errors.budget}>
            <FieldLabel htmlFor="budget">{t("budget")}</FieldLabel>
            <FormSelect
              control={form.control}
              name="budget"
              id="budget"
              invalid={!!errors.budget}
              placeholder={t("budgetPlaceholder")}
              options={INQUIRY_BUDGETS.map((budget) => ({ value: budget, label: t(`budgets.${budget}`) }))}
            />
            <FieldError errors={errorFor(errors.budget?.message)} />
          </Field>
        </div>

        <Field data-invalid={!!errors.message}>
          <div className="flex items-baseline justify-between gap-2">
            <FieldLabel htmlFor="message">{t("message")}</FieldLabel>
            <span className="text-sm text-muted-foreground">
              {t("count", { count: message.length, max: INQUIRY_LIMITS.message })}
            </span>
          </div>
          <Textarea id="message" rows={7} aria-invalid={!!errors.message} {...form.register("message")} />
          <FieldDescription>{t("messageHint")}</FieldDescription>
          <FieldError errors={errorFor(errors.message?.message)} />
        </Field>

        {/* Honeypot: invisible to people, filled by bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input ref={honeypot} id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </FieldGroup>

      <p className="max-w-prose text-sm text-muted-foreground">{t("privacy")}</p>

      <div className="flex flex-col gap-2">
        <TurnstileWidget
          ref={turnstile}
          siteKey={siteKey}
          action={action}
          nonce={nonce}
          language={locale}
          onToken={(value) => {
            setToken(value);
            if (value) setChallengeFailed(false);
          }}
          onLoadError={() => setWidgetError(true)}
          onChallengeError={() => setChallengeFailed(true)}
        />
        {widgetError && <p className="text-sm text-destructive">{t("errors.widget")}</p>}
        {challengeFailed && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-destructive">{t("errors.captcha")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setChallengeFailed(false);
                turnstile.current?.reset();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" disabled={pending || !token}>
          {/* Disabled until Turnstile issues a token; the widget itself tells
              the visitor what to do (Managed mode may ask for a click). */}
          {pending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
