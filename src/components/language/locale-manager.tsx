"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function LocaleManager() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";

  useEffect(() => {
    // Set lang attribute on html element
    // Keep LTR direction for all languages to maintain layout
    const html = document.documentElement;
    html.setAttribute("lang", locale);
    html.setAttribute("dir", "ltr");
  }, [locale]);

  return null;
}
