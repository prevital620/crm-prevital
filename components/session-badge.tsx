"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

export default function SessionBadge() {
  const [fullName, setFullName] = useState("Usuario");
  const [roleName, setRoleName] = useState("Rol");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSessionInfo() {
      try {
        const auth = await getCurrentUserRole();

        if (!auth.user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", auth.user.id)
          .single();

        setFullName(profile?.full_name || "Usuario");
        setRoleName(auth.roleName || "Rol");
      } catch {
      } finally {
        setLoading(false);
      }
    }

    loadSessionInfo();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-[24px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_48%,_#5F7D66_100%)] px-5 py-3 text-white shadow-[0_18px_34px_rgba(63,105,82,0.24)]">
        <p className="text-sm font-semibold tracking-tight">
          {loading ? "Cargando..." : fullName}
        </p>
        <p className="text-xs text-[#DDF4E8]">
          {loading ? "..." : roleName}
        </p>
      </div>

      <LogoutButton />
    </div>
  );
}
