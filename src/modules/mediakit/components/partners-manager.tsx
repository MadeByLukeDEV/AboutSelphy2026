"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { AdminPartner } from "../admin-service";
import {
  addPartnerAction,
  deletePartnerAction,
  editPartnerAction,
  movePartnerAction,
  removePartnerLogoAction,
  type PartnersResult,
} from "../actions";
import { postUpload } from "@/lib/post-upload";
import { PARTNER_LIMITS, partnerInputSchema, type PartnerInput } from "../schema";

const EMPTY: PartnerInput = {
  name: "",
  url: "https://",
  code: "",
  descriptionEn: "",
  descriptionDe: "",
  visible: true,
};

// Partners with reorder, edit, delete, logo upload and a "show in media
// kit" switch. State is replaced with each action's returned list.
export function PartnersManager({ initial }: { initial: AdminPartner[] }) {
  const t = useTranslations("Admin.partners");
  const [partners, setPartners] = useState(initial);
  const [editing, setEditing] = useState<AdminPartner | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminPartner | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(result: PartnersResult, success?: string) {
    if (result.ok) {
      setPartners(result.partners);
      if (success) toast.success(success);
      return true;
    }
    toast.error(t(`errors.${result.error}`));
    return false;
  }

  function run(action: () => Promise<PartnersResult>, success?: string) {
    startTransition(async () => {
      apply(await action(), success);
    });
  }

  function upload(partner: AdminPartner, file: File) {
    // Checked again on the server (real format, size, re-encoding).
    const body = new FormData();
    body.set("file", file);
    setUploadingId(partner.id);
    startTransition(async () => {
      apply(
        await postUpload<PartnersResult>(`/api/admin/partners/${encodeURIComponent(partner.id)}/logo`, body),
        t("logoUpdated"),
      );
      setUploadingId(null);
    });
  }

  const inputOf = (p: AdminPartner): PartnerInput => ({
    name: p.name,
    url: p.url,
    code: p.code,
    descriptionEn: p.descriptionEn,
    descriptionDe: p.descriptionDe,
    visible: p.visible,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {partners.length === 0 ? (
        <p className="rounded-xl border bg-background p-4">{t("empty")}</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-background">
          {partners.map((partner, index) => (
            <li key={partner.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveUp", { name: partner.name })}
                  disabled={isPending || index === 0}
                  onClick={() => run(() => movePartnerAction(partner.id, "up"))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveDown", { name: partner.name })}
                  disabled={isPending || index === partners.length - 1}
                  onClick={() => run(() => movePartnerAction(partner.id, "down"))}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              <span className="relative flex h-12 w-24 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                {partner.logoUrl ? (
                  <Image src={partner.logoUrl} alt="" fill sizes="6rem" className="object-contain p-1.5" />
                ) : (
                  <span className="text-xs text-muted-foreground">{t("noLogo")}</span>
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-semibold">{partner.name}</p>
                  {partner.code && <p className="text-sm text-muted-foreground">{t("codeShown", { code: partner.code })}</p>}
                  {!partner.visible && <p className="text-sm font-medium text-muted-foreground">{t("hiddenBadge")}</p>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{partner.url}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{partner.descriptionEn}</p>
                <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-sm">
                  <Switch
                    checked={partner.visible}
                    disabled={isPending}
                    onCheckedChange={(visible) =>
                      run(
                        () => editPartnerAction(partner.id, { ...inputOf(partner), visible }),
                        visible ? t("shown", { name: partner.name }) : t("hidden", { name: partner.name }),
                      )
                    }
                  />
                  {t("visible")}
                </label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      uploadingId === partner.id && "pointer-events-none opacity-60",
                    )}
                  >
                    <ImageUp aria-hidden />
                    {uploadingId === partner.id
                      ? t("uploading")
                      : partner.logoUrl
                        ? t("replaceLogo")
                        : t("uploadLogo")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      className="sr-only"
                      disabled={uploadingId !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) upload(partner, file);
                      }}
                    />
                  </label>
                  {partner.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => removePartnerLogoAction(partner.id), t("logoUpdated"))}
                    >
                      {t("removeLogo")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(partner)}>
                  <Pencil aria-hidden />
                  {t("edit")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(partner)}>
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
            <PartnerForm
              partner={editing === "new" ? null : editing}
              initial={editing === "new" ? EMPTY : inputOf(editing)}
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
            <DialogTitle>{t("confirmTitle", { name: deleting?.name ?? "" })}</DialogTitle>
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
                  if (apply(await deletePartnerAction(target.id), t("deleted"))) setDeleting(null);
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

function PartnerForm({
  partner,
  initial,
  onDone,
  onCancel,
}: {
  partner: AdminPartner | null;
  initial: PartnerInput;
  onDone: (result: PartnersResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.partners");
  const [isPending, startTransition] = useTransition();
  const form = useForm<PartnerInput>({
    resolver: zodResolver(partnerInputSchema),
    defaultValues: initial,
  });
  const { errors } = form.formState;
  const messageFor = (code: string | undefined) =>
    code ? [{ message: t(`errors.${code as "required"}`) }] : undefined;

  function onSubmit(values: PartnerInput) {
    startTransition(async () => {
      onDone(partner ? await editPartnerAction(partner.id, values) : await addPartnerAction(values));
    });
  }

  const description = (name: "descriptionEn" | "descriptionDe", label: string, lang: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        id={name}
        lang={lang}
        rows={3}
        maxLength={PARTNER_LIMITS.description + 50}
        aria-invalid={!!errors[name]}
        {...form.register(name)}
      />
      <FieldError errors={messageFor(errors[name]?.message)} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{partner ? t("dialogEdit", { name: partner.name }) : t("dialogAdd")}</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={messageFor(errors.name?.message)} />
          </Field>
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
            <Input id="code" aria-invalid={!!errors.code} {...form.register("code")} />
            <FieldDescription>{t("codeHint")}</FieldDescription>
            <FieldError errors={messageFor(errors.code?.message)} />
          </Field>
        </div>

        <Field data-invalid={!!errors.url}>
          <FieldLabel htmlFor="url">{t("url")}</FieldLabel>
          <Input id="url" type="url" inputMode="url" aria-invalid={!!errors.url} {...form.register("url")} />
          <FieldDescription>{t("urlHint")}</FieldDescription>
          <FieldError errors={messageFor(errors.url?.message)} />
        </Field>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t("description")}</p>
          <FieldDescription>{t("descriptionHint")}</FieldDescription>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {description("descriptionEn", t("english"), "en")}
          {description("descriptionDe", t("german"), "de")}
        </div>

        <Field orientation="horizontal">
          <Controller
            control={form.control}
            name="visible"
            render={({ field }) => (
              <Switch id="visible" checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
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
