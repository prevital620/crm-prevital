import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface PrevitalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#5E8F6C] text-white shadow-[0_10px_25px_rgba(94,143,108,0.18)] hover:bg-[#4F6F5B] active:bg-[#3D5848]",
  secondary:
    "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#EAF4EC]",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-sm rounded-2xl",
  lg: "h-12 px-5 text-base rounded-2xl",
};

export const PrevitalButton = React.forwardRef<
  HTMLButtonElement,
  PrevitalButtonProps
>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "prevital-focus-ring inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled}
        {...props}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        <span>{children}</span>
        {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
      </button>
    );
  }
);

PrevitalButton.displayName = "PrevitalButton";
