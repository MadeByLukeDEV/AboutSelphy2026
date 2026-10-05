"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchTwitchCategoriesAction } from "../actions";
import type { StreamGame } from "../schema";

type TwitchResult = { id: string; name: string; boxArtUrl: string };

// What a stream is about: nothing, one of the Games, or a Twitch category
// found by search -- that one isn't added to the Games section (the user's
// wish: schedule a game without listing it on the home page).
export function GamePicker({
  id,
  value,
  onChange,
  games,
  twitchSearch,
}: {
  id: string;
  value: StreamGame;
  onChange: (value: StreamGame) => void;
  games: Array<{ id: string; name: string }>;
  /** False when Twitch isn't configured: the search box is hidden. */
  twitchSearch: boolean;
}) {
  const t = useTranslations("Admin.schedule");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TwitchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const latest = useRef(0);

  // Debounced search; only the newest request's answer is shown.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setStatus("loading");
      let result: Awaited<ReturnType<typeof searchTwitchCategoriesAction>>;
      try {
        result = await searchTwitchCategoriesAction(q);
      } catch {
        // Network error or a redeploy that changed the action id.
        result = { ok: false, error: "failed" };
      }
      if (ticket !== latest.current) return;
      if (result.ok) {
        setResults(result.results);
        setStatus("idle");
      } else {
        setResults([]);
        setStatus("failed");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectValue = value.kind === "game" ? value.id : value.kind === "twitch" ? "twitch" : "";
  const options = [
    { value: "", label: t("noGame") },
    ...games.map((game) => ({ value: game.id, label: game.name })),
    ...(value.kind === "twitch" ? [{ value: "twitch", label: t("twitchPick", { name: value.name }) }] : []),
  ];
  const visibleResults = query.trim().length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-3">
      <Select
        items={options}
        value={selectValue}
        onValueChange={(next) => {
          if (next === "twitch") return;
          onChange(next ? { kind: "game", id: next } : { kind: "none" });
        }}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {twitchSearch && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <label htmlFor={`${id}-search`} className="text-sm font-medium">
            {t("twitchSearch")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id={`${id}-search`}
              type="search"
              className="pl-8"
              placeholder={t("twitchSearchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {status === "loading"
              ? t("twitchSearching")
              : status === "failed"
                ? t("twitchSearchFailed")
                : query.trim().length >= 2 && visibleResults.length === 0
                  ? t("twitchNoResults")
                  : t("twitchSearchHint")}
          </p>
          {visibleResults.length > 0 && (
            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {visibleResults.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => {
                      onChange({ kind: "twitch", ...result });
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <Cover src={result.boxArtUrl} />
                    <span className="text-sm font-medium">{result.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {value.kind === "twitch" && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-2">
          <Cover src={value.boxArtUrl} />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{value.name}</span>
            <span className="block text-xs text-muted-foreground">{t("twitchPickedHint")}</span>
          </p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("twitchClear")} onClick={() => onChange({ kind: "none" })}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function Cover({ src }: { src: string }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border">
      {src ? <Image src={src} alt="" fill sizes="2.5rem" className="object-cover" /> : null}
    </span>
  );
}
