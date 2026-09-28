"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPackage } from "../admin-service";
import {
  addPackageAction,
  deletePackageAction,
  editPackageAction,
  movePackageAction,
  type PackagesResult,
} from "../actions";
import { PACKAGE_LIMITS, packageInputSchema, type PackageInput } from "../schema";

// The form edits the price as text ("" = on request); the shared schema
// (also enforced by the server actions) validates the resulting number.
const formSchema = packageInputSchema.extend({
  priceFrom: z.string().trim().regex(/^\d{0,7}$/, { message: "invalidPrice" }),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  titleEn: "",
  titleDe: "",
  descriptionEn: "",
  descriptionDe: "",
  priceFrom: "",
  visible: true,
};

const inputOf = (p: AdminPackage): PackageInput => ({
  titleEn: p.titleEn,
  titleDe: p.titleDe,
  descriptionEn: p.descriptionEn,
  descriptionDe: p.descriptionDe,
  priceFrom: p.priceFrom,
  visible: p.visible,
});

export function PackagesManager({ initial }: { initial: AdminPackage[] }) {
  const t = useTranslations("Admin.packages");
  const [packages, setPackages] = useState(initial);
  const [editing, setEditing] = useState<AdminPackage | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminPackage | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(result: PackagesResult, success?: string) {
    if (result.ok) {
      setPackages(result.packages);
      if (success) toast.success(success);
      return true;
    }
    toast.error(t(`errors.${result.error === "invalid" || result.error === "forbidden" ? result.error : "failed"}`));
    return false;
  }

  function run(action: () => Promise<PackagesResult>, success?: string) {
    startTransition(async () => {
      apply(await action(), success);
    });
  }

  const price = (value: number | null) =>
    value === null ? t("onRequest") : t("from", { price: `${value.toLocaleString("de-AT")} €` });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {packages.length === 0 ? (
        <p className="rounded-xl border bg-background p-4">{t("empty")}</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-background">
          {packages.map((pkg, index) => (
            <li key={pkg.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveUp", { name: pkg.titleEn })}
                  disabled={isPending || index === 0}
                  onClick={() => run(() => movePackageAction(pkg.id, "up"))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveDown", { name: pkg.titleEn })}
                  disabled={isPending || index === packages.length - 1}
                  onClick={() => run(() => movePackageAction(pkg.id, "down"))}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-semibold">{pkg.titleEn}</p>
                  <p className="text-sm text-muted-foreground">{price(pkg.priceFrom)}</p>
                  {!pkg.visible && <p className="text-sm font-medium text-muted-foreground">{t("hiddenBadge")}</p>}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{pkg.descriptionEn}</p>
                <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-sm">
                  <Switch
                    checked={pkg.visible}
                    disabled={isPending}
                    onCheckedChange={(visible) =>
                      run(
                        () => editPackageAction(pkg.id, { ...inputOf(pkg), visible }),
                        visible ? t("shown", { name: pkg.titleEn }) : t("hidden", { name: pkg.titleEn }),
                      )
                    }
                  />
                  {t("visible")}
                </label>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(pkg)}>
                  <Pencil aria-hidden />
                  {t("edit")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(pkg)}>
                  <Trash2 aria-hidden />
                  {t("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {editing !== null && (
            <PackageForm
              pkg={editing === "new" ? null : editing}
              onDone={(result) => {
                if (apply(result, t("saved"))) setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", { name: deleting?.titleEn ?? "" })}</DialogTitle>
            <DialogDescription>{t("confirmText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!deleting) return;
                const target = deleting;
                startTransition(async () => {
                  if (apply(await deletePackageAction(target.id), t("deleted"))) setDeleting(null);
                });
              }}
            >
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageForm({
  pkg,
  onDone,
  onCancel,
}: {
  pkg: AdminPackage | null;
  onDone: (result: PackagesResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.packages");
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: pkg ? { ...inputOf(pkg), priceFrom: pkg.priceFrom === null ? "" : String(pkg.priceFrom) } : EMPTY,
  });
  const { errors } = form.formState;
  const messageFor = (code: string | undefined) =>
    code ? [{ message: t(`errors.${code as "required"}`) }] : undefined;

  function onSubmit(values: FormValues) {
    const input: PackageInput = { ...values, priceFrom: values.priceFrom === "" ? null : Number(values.priceFrom) };
    startTransition(async () => {
      onDone(pkg ? await editPackageAction(pkg.id, input) : await addPackageAction(input));
    });
  }

  const field = (
    name: "titleEn" | "titleDe" | "descriptionEn" | "descriptionDe",
    label: string,
    lang: string,
    multiline = false,
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={name}
          lang={lang}
          rows={4}
          maxLength={PACKAGE_LIMITS.description + 50}
          aria-invalid={!!errors[name]}
          {...form.register(name)}
        />
      ) : (
        <Input id={name} lang={lang} aria-invalid={!!errors[name]} {...form.register(name)} />
      )}
      <FieldError errors={messageFor(errors[name]?.message)} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{pkg ? t("dialogEdit", { name: pkg.titleEn }) : t("dialogAdd")}</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("titleEn", t("titleEn"), "en")}
          {field("titleDe", t("titleDe"), "de")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("descriptionEn", t("descriptionEn"), "en", true)}
          {field("descriptionDe", t("descriptionDe"), "de", true)}
        </div>
        <Field data-invalid={!!errors.priceFrom}>
          <FieldLabel htmlFor="priceFrom">{t("price")}</FieldLabel>
          <Input
            id="priceFrom"
            inputMode="numeric"
            className="max-w-40"
            aria-invalid={!!errors.priceFrom}
            {...form.register("priceFrom")}
          />
          <FieldDescription>{t("priceHint")}</FieldDescription>
          <FieldError errors={messageFor(errors.priceFrom?.message)} />
        </Field>
        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="visible"
            render={({ field: f }) => (
              <Switch id="visible" checked={f.value} onCheckedChange={f.onChange} onBlur={f.onBlur} />
            )}
          />
          <FieldLabel htmlFor="visible">{t("visible")}</FieldLabel>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
