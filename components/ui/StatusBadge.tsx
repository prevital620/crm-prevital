import React from "react";

type StatusBadgeProps = {
  label: string;
  className?: string;
};

export default function StatusBadge({ label, className = "bg-slate-100 text-slate-700" }: StatusBadgeProps) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
