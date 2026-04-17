import React from "react";
import { repairMojibake } from "@/lib/text/repairMojibake";

type FieldProps = {
  label: string;
  input: React.ReactNode;
  helperText?: string;
};

export default function Field({ label, input, helperText }: FieldProps) {
  const safeLabel = repairMojibake(label);
  const safeHelperText = helperText ? repairMojibake(helperText) : "";

  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{safeLabel}</div>
      {input}
      {safeHelperText ? <p className="mt-2 text-xs text-slate-500">{safeHelperText}</p> : null}
    </label>
  );
}
