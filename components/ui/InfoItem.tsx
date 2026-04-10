import React from "react";

type InfoItemProps = {
  label: string;
  value: string;
};

export default function InfoItem({ label, value }: InfoItemProps) {
  return (
    <p>
      <span className="font-medium text-slate-800">{label}:</span> {value}
    </p>
  );
}
