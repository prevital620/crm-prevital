import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM Prevital",
  description: "Sistema interno de gestión para Prevital.",
};

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
