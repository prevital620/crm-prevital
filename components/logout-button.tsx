"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:opacity-60"
    >
      {loading ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
