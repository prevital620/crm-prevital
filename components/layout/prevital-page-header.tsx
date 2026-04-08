import * as React from "react";
import { cn } from "@/lib/utils";

export function PrevitalPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-[0_10px_30px_rgba(79,111,91,0.08)] lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
