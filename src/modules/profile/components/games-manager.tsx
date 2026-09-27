"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AdminGame } from "../admin-service";
import {
  addGameAction,
  deleteGameAction,
  editGameAction,
  moveGameAction,
  type GamesResult,
} from "../actions";
import { GAME_LIMITS, GAME_STATUSES, gameInputSchema } from "../schema";

// The form edits tags as one comma-separated string; the shared schema (also
// enforced by the server actions) validates the resulting array.
const formSchema = gameInputSchema.extend({ tags: z.string() });
type FormValues = z.infer<typeof formSchema>;

function toTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const EMPTY: FormValues = {
  name: "",
  status: "regular",
  blurbEn: "",
  blurbDe: "",
  tags: "",
};

// Lists the games with reorder/edit/delete and an add button. State is seeded
// from the server and replaced with each action's returned list (CLAUDE.md:
// server-seeded client state doesn't update on revalidation).
export function GamesManager({ initial }: { initial: AdminGame[] }) {
  const t = useTranslations("Admin.games");
  const [games, setGames] = useState(initial);
  const [editing, setEditing] = useState<AdminGame | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminGame | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(result: GamesResult, success?: string) {
    if (result.ok) {
      setGames(result.games);
      if (success) toast.success(success);
      return true;
    }
    toast.error(t(`errors.${result.error}`));
    return false;
  }

  function move(game: AdminGame, direction: "up" | "down") {
    startTransition(async () => {
      apply(await moveGameAction(game.id, direction));
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      if (apply(await deleteGameAction(target.id), t("deleted"))) setDeleting(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {games.length === 0 ? (
        <p className="rounded-xl border bg-background p-4">{t("empty")}</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-background">
          {games.map((game, index) => (
            <li key={game.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveUp", { name: game.name })}
                  disabled={isPending || index === 0}
                  onClick={() => move(game, "up")}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("moveDown", { name: game.name })}
                  disabled={isPending || index === games.length - 1}
                  onClick={() => move(game, "down")}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className={cn("font-semibold", game.status === "former" && "text-muted-foreground")}>
                    {game.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{t(`statuses.${game.status}`)}</p>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{game.blurbEn}</p>
                {game.tags.length > 0 && (
                  <p className="flex flex-wrap gap-1.5">
                    {game.tags.map((tag) => (
                      <span key={tag} className="rounded-md border px-2 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(game)}>
                  <Pencil aria-hidden />
                  {t("edit")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(game)}>
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
            <GameForm
              game={editing === "new" ? null : editing}
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
            <Button type="button" variant="destructive" disabled={isPending} onClick={confirmDelete}>
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GameForm({
  game,
  onDone,
  onCancel,
}: {
  game: AdminGame | null;
  onDone: (result: GamesResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.games");
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: game ? { ...game, tags: game.tags.join(", ") } : EMPTY,
  });
  const { errors } = form.formState;
  const [tagError, setTagError] = useState<string | null>(null);

  const messageFor = (code: string | undefined) =>
    code === "required" || code === "tooLong" ? [{ message: t(`errors.${code}`) }] : undefined;

  function onSubmit(values: FormValues) {
    const input = { ...values, tags: toTags(values.tags) };
    const tagsCheck = gameInputSchema.shape.tags.safeParse(input.tags);
    if (!tagsCheck.success) {
      const code = tagsCheck.error.issues[0]?.message;
      setTagError(t(code === "tooManyTags" ? "errors.tooManyTags" : "errors.tagTooLong"));
      return;
    }
    setTagError(null);
    startTransition(async () => {
      onDone(game ? await editGameAction(game.id, input) : await addGameAction(input));
    });
  }

  const blurb = (name: "blurbEn" | "blurbDe", label: string, lang: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        id={name}
        lang={lang}
        rows={3}
        maxLength={GAME_LIMITS.blurb + 50}
        aria-invalid={!!errors[name]}
        {...form.register(name)}
      />
      <FieldError errors={messageFor(errors[name]?.message)} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{game ? t("dialogEdit", { name: game.name }) : t("dialogAdd")}</DialogTitle>
      </DialogHeader>

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={messageFor(errors.name?.message)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="status">{t("status")}</FieldLabel>
            <select
              id="status"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              {...form.register("status")}
            >
              {GAME_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t("blurb")}</p>
          <FieldDescription>{t("blurbHint")}</FieldDescription>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {blurb("blurbEn", t("english"), "en")}
          {blurb("blurbDe", t("german"), "de")}
        </div>

        <Field data-invalid={!!tagError}>
          <FieldLabel htmlFor="tags">{t("tags")}</FieldLabel>
          <Input id="tags" aria-invalid={!!tagError} {...form.register("tags")} />
          <FieldDescription>{t("tagsHint")}</FieldDescription>
          {tagError && <FieldError>{tagError}</FieldError>}
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
