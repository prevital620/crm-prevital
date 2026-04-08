import * as React from "react";
import { cn } from "@/lib/utils";

export function PrevitalFilterBar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PrevitalFilterGroup({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-1 flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}

export function PrevitalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "prevital-focus-ring h-11 rounded-2xl border border-slate-200 bg-[#F8F7F4] px-4 text-sm text-slate-700 placeholder:text-slate-400",
        props.className
      )}
    />
  );
}

export function PrevitalSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      className={cn(
        "prevital-focus-ring h-11 rounded-2xl border border-slate-200 bg-[#F8F7F4] px-4 text-sm text-slate-700",
        props.className
      )}
    />
  );
}

