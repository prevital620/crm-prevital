import React from "react";
import { repairMojibake } from "@/lib/text/repairMojibake";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export default function StatCard({ title, value, subtitle }: StatCardProps) {
  const safeTitle = repairMojibake(title);
  const safeSubtitle = subtitle ? repairMojibake(subtitle) : "";

  return (
    <div className="group overflow-hidden rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)] transition duration-200 hover:-translate-y-1 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.18)]">
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{safeTitle}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
      {safeSubtitle ? <p className="mt-2 text-xs text-[#6B7F74]">{safeSubtitle}</p> : null}
    </div>
  );
}
