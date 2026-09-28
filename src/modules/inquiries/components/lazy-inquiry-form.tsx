"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// The inquiry form sits at the bottom of the media kit, but its code
// (react-hook-form, zod, the select, Turnstile) was ~160 KB loaded with the
// page and delayed its first paint on phones (Lighthouse, 2026-09-29). It
// now loads once the visitor is about a screen away from it. The skeleton
// has roughly the form's height, so nothing jumps when it swaps in.
const InquiryForm = dynamic(() => import("./inquiry-form").then((m) => m.InquiryForm), {
  ssr: false,
  loading: () => <FormSkeleton />,
});

function FormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

export function LazyInquiryForm(props: ComponentProps<typeof InquiryForm>) {
  const anchor = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setNear(true);
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={anchor}>{near ? <InquiryForm {...props} /> : <FormSkeleton />}</div>;
}
