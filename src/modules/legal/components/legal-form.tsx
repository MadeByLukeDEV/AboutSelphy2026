"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveLegalAction } from "../actions";
import { legalInputSchema, TODO_MARKER, type LegalInput } from "../schema";

type Field = keyof Omit<LegalInput, "published">;

// Operator details (the Impressum is built from them), extra Impressum
// text and the privacy policy per language, plus the publish switch.
// The shared schema blocks publishing while details are missing or a
// TODO marker from the draft is left; the server re-checks everything.
export function LegalForm({ initial }: { initial: LegalInput }) {
  const t = useTranslations("Admin.legal");
  const [isPending, startTransition] = useTransition();
  const form = useForm<LegalInput>({ resolver: zodResolver(legalInputSchema), defaultValues: initial });
  const { errors } = form.formState;
  const [privacyEn, privacyDe] = useWatch({ control: form.control, name: ["privacyEn", "privacyDe"] });
  const todos =
    (privacyEn.split(TODO_MARKER).length - 1) + (privacyDe.split(TODO_MARKER).length - 1);

  const messageFor = (code: string | undefined) =>
    code ? [{ message: t(`errors.${code as "tooLong"}`) }] : undefined;

  function onSubmit(values: LegalInput) {
    startTransition(async () => {
      const result = await saveLegalAction(values);
      if (result.ok) {
        form.reset(result.legal);
        toast.success(result.legal.published ? t("savedPublished") : t("saved"));
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  const input = (name: Field, type = "text", autoComplete?: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{t(`fields.${name}`)}</FieldLabel>
      <Input id={name} type={type} autoComplete={autoComplete} aria-invalid={!!errors[name]} {...form.register(name)} />
      <FieldError errors={messageFor(errors[name]?.message)} />
    </Field>
  );

  const area = (name: Field, rows: number, lang: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{t(`fields.${name}`)}</FieldLabel>
      <Textarea
        id={name}
        lang={lang}
        rows={rows}
        className="font-mono text-sm"
        aria-invalid={!!errors[name]}
        {...form.register(name)}
      />
      <FieldError errors={messageFor(errors[name]?.message)} />
    </Field>
  );

  return (
    <form
      onSubmit={(event) => form.handleSubmit(onSubmit)(event)}
      noValidate
      className="flex max-w-5xl flex-col gap-10"
    >
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-xl font-bold">{t("operatorHeading")}</h2>
          <FieldDescription>{t("operatorHint")}</FieldDescription>
        </div>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("operatorName", "text", "name")}
            {input("email", "email", "email")}
            {input("street", "text", "street-address")}
            {input("phone", "tel", "tel")}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {input("postalCode", "text", "postal-code")}
            {input("city", "text", "address-level2")}
            {input("country", "text", "country-name")}
          </div>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-xl font-bold">{t("imprintHeading")}</h2>
          <FieldDescription>{t("imprintHint")}</FieldDescription>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {area("imprintExtraEn", 5, "en")}
          {area("imprintExtraDe", 5, "de")}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-xl font-bold">{t("privacyHeading")}</h2>
          <FieldDescription>{t("privacyHint")}</FieldDescription>
          {todos > 0 && (
            <p className="text-sm font-medium text-destructive">{t("todosLeft", { count: todos })}</p>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {area("privacyEn", 24, "en")}
          {area("privacyDe", 24, "de")}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-background p-4">
        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="published"
            render={({ field }) => (
              <Switch id="published" checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
          <FieldLabel htmlFor="published">{t("published")}</FieldLabel>
        </Field>
        <FieldDescription>{t("publishedHint")}</FieldDescription>
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </section>
    </form>
  );
}
