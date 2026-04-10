import React from "react";

type FieldProps = {
  label: string;
  input: React.ReactNode;
  helperText?: string;
};

export default function Field({ label, input, helperText }: FieldProps) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {input}
      {helperText ? <p className="mt-2 text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
