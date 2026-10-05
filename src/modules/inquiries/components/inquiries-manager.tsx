"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminInquiries } from "../admin-service";
import {
  deleteInquiryAction,
  setInquiryStatusAction,
  type InquiriesResult,
} from "../actions";
import { INQUIRY_STATUSES } from "../schema";

type Status = (typeof INQUIRY_STATUSES)[number];

// Staff inbox for sponsor inquiries. Everything is rendered as text --
// inquiry content comes from strangers and is never treated as HTML.
export function InquiriesManager({ initial }: { initial: AdminInquiries }) {
  const t = useTranslations("Admin.inquiries");
  const tb = useTranslations("Inquiry.budgets");
  const format = useFormatter();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<Status | "all">("new");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(result: InquiriesResult, success: string) {
    if (result.ok) {
      setData(result.data);
      toast.success(success);
      return true;
    }
    toast.error(t(`errors.${result.error}`));
    return false;
  }

  const visible = data.inquiries.filter((i) => filter === "all" || i.status === filter);
  const statusItems = INQUIRY_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }));
  const total = data.inquiries.length;

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2" data-tour="inquiry-filter">
        {(["new", "in_progress", "done", "spam", "all"] as const).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "default" : "outline"}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? t("all") : t(`statuses.${key}`)}
            <span className="tabular-nums opacity-70">
              {key === "all" ? total : (data.counts[key] ?? 0)}
            </span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border bg-background p-4">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((inquiry) => (
            <li key={inquiry.id} className="flex flex-col gap-3 rounded-xl border bg-background p-4" data-tour="inquiry-item">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <p className="font-semibold">{inquiry.company}</p>
                  <p className="text-sm text-muted-foreground">
                    {inquiry.contactName}
                    {" – "}
                    <span className="break-all">{inquiry.email}</span>
                  </p>
                </div>
                <Select
                  items={statusItems}
                  value={inquiry.status}
                  onValueChange={(value) =>
                    value &&
                    startTransition(async () => {
                      apply(await setInquiryStatusAction(inquiry.id, value), t("updated"));
                    })
                  }
                  disabled={pending}
                >
                  <SelectTrigger aria-label={t("status")} className="h-8 min-w-36" data-tour="inquiry-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t("received", {
                    date: format.dateTime(new Date(inquiry.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </span>
                <span>{t("budget", { budget: tb(inquiry.budget) })}</span>
                <span>{t("language", { locale: inquiry.locale.toUpperCase() })}</span>
              </p>
              <p className={cn("whitespace-pre-wrap break-words", inquiry.status === "spam" && "text-muted-foreground")}>
                {inquiry.message}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  data-tour="inquiry-reply"
                  href={`mailto:${encodeURIComponent(inquiry.email)}?subject=${encodeURIComponent(t("replySubject"))}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Mail aria-hidden />
                  {t("reply")}
                </a>
                <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(inquiry.id)}>
                  <Trash2 aria-hidden />
                  {t("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const id = deleting;
                if (!id) return;
                startTransition(async () => {
                  if (apply(await deleteInquiryAction(id), t("deleted"))) setDeleting(null);
                });
              }}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
