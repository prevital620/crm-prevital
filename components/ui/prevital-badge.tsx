import * as React from "react";
import { cn } from "@/lib/utils";
import { getPrevitalStatusStyle } from "@/lib/prevital-theme";

export function PrevitalBadge({
  status,
  children,
  className,
}: {
  status?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const style = getPrevitalStatusStyle(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {children}
    </span>
  );
}
