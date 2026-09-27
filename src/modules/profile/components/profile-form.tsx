"use client";

import { useTransition } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileAction } from "../actions";
import {
  PROFILE_LIMITS,
  profileInputSchema,
  type ProfileInput,
} from "../schema";

type FieldName = keyof ProfileInput;

function Counter({
  control,
  name,
  max,
}: {
  control: Control<ProfileInput>;
  name: FieldName;
  max: number;
}) {
  const t = useTranslations("Admin.about");
  const value = useWatch({ control, name }) ?? "";
  return (
    <span
      className={value.length > max ? "text-destructive" : "text-muted-foreground"}
    >
      {t("count", { count: value.length, max })}
    </span>
  );
}

// Edits the home page text. Validation runs here for instant feedback and
// again in saveProfileAction (the server never trusts the form).
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const t = useTranslations("Admin.about");
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: initial,
  });
  const { errors, isDirty } = form.formState;

  const errorFor = (name: FieldName) => {
    const code = errors[name]?.message;
    return code === "required" || code === "tooLong"
      ? [{ message: t(`errors.${code}`) }]
      : undefined;
  };

  function onSubmit(values: ProfileInput) {
    startTransition(async () => {
      const result = await saveProfileAction(values);
      if (result.ok) {
        // Reset to what the server stored (trimmed), so the form is clean.
        form.reset(result.profile);
        toast.success(t("saved"));
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  const localized = (
    base: "tagline" | "bio",
    locale: "En" | "De",
    label: string,
  ) => {
    const name = `${base}${locale}` as FieldName;
    const max = base === "bio" ? PROFILE_LIMITS.bio : PROFILE_LIMITS.tagline;
    const Control = base === "bio" ? Textarea : Input;
    return (
      <Field data-invalid={!!errors[name]}>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Counter control={form.control} name={name} max={max} />
        </div>
        <Control
          id={name}
          lang={locale === "De" ? "de" : "en"}
          aria-invalid={!!errors[name]}
          {...(base === "bio" ? { rows: 12 } : {})}
          {...form.register(name)}
        />
        <FieldError errors={errorFor(name)} />
      </Field>
    );
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-10"
    >
      <FieldGroup>
        <Field data-invalid={!!errors.displayName} className="max-w-md">
          <FieldLabel htmlFor="displayName">{t("displayName")}</FieldLabel>
          <Input
            id="displayName"
            aria-invalid={!!errors.displayName}
            {...form.register("displayName")}
          />
          <FieldError errors={errorFor("displayName")} />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>{t("tagline")}</FieldLegend>
        <FieldDescription>{t("taglineHint")}</FieldDescription>
        <div className="grid gap-6 lg:grid-cols-2">
          {localized("tagline", "En", t("english"))}
          {localized("tagline", "De", t("german"))}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>{t("bio")}</FieldLegend>
        <FieldDescription>{t("bioHint")}</FieldDescription>
        <div className="grid gap-6 lg:grid-cols-2">
          {localized("bio", "En", t("english"))}
          {localized("bio", "De", t("german"))}
        </div>
      </FieldSet>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
