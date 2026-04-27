import type { Metadata } from "next";
import PWARegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "CRM Prevital",
  description: "Sistema interno de gestión para Prevital.",
  manifest: "/crm-manifest.json",
};

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PWARegister scope="/crm" scriptUrl="/crm-sw.js" />
      {children}
    </>
  );
}
