import * as React from "react";
import { cn } from "@/lib/utils";

export function PrevitalTableShell({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(79,111,91,0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PrevitalTable({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("min-w-full text-sm", className)} {...props} />
    </div>
  );
}

export function PrevitalTableHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-[#F3F5F1] text-left text-slate-500", className)}
      {...props}
    />
  );
}

export function PrevitalTableHeaderCell({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide", className)}
      {...props}
    />
  );
}

export function PrevitalTableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100", className)} {...props} />;
}

export function PrevitalTableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-[#F8FBF8]", className)}
      {...props}
    />
  );
}

export function PrevitalTableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-4 align-middle text-slate-700", className)} {...props} />;
}
