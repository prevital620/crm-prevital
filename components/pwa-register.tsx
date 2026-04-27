"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PWARegisterProps = {
  scope?: string;
  scriptUrl?: string;
  disabledOnPrefixes?: string[];
};

export default function PWARegister({
  scope = "/",
  scriptUrl = "/sw.js",
  disabledOnPrefixes = [],
}: PWARegisterProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (disabledOnPrefixes.some((prefix) => pathname?.startsWith(prefix))) return;

    const registerSW = async () => {
      try {
        await navigator.serviceWorker.register(scriptUrl, { scope });
      } catch (error) {
        console.error("No se pudo registrar el service worker:", error);
      }
    };

    registerSW();
  }, [disabledOnPrefixes, pathname, scope, scriptUrl]);

  return null;
}
