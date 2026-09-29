"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSiteLocale, stripSiteLocale, type SiteLocale } from "../../lib/site-locale";

const LocaleContext = createContext<SiteLocale>("ru");

export function SiteLocaleProvider({ locale, children }: { locale: SiteLocale; children?: ReactNode }) {
  const pathname = usePathname();
  const currentLocale = pathname ? getSiteLocale(pathname) : locale;
  useEffect(() => {
    document.documentElement.lang = currentLocale;
    const path = stripSiteLocale(pathname || "/");
    if (path !== "/chat") {
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", path === "/" || path === "/auth" ? "#000000" : "#ffffff");
    }
    // These client workspaces switch presentation without discarding private form state.
    if (path === "/astrology" || path.startsWith("/admin/orchestra/astrology")) {
      document.title = (currentLocale === "en" ? "Astrology workspace" : "Астрологическая мастерская") + " — JGPT-FUN";
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.href = new URL(pathname || "/", canonical.href).href;
      for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
        document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", document.title);
      }
      document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.setAttribute("content", currentLocale === "en" ? "en_US" : "ru_RU");
      if (canonical) document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonical.href);
    }
  }, [currentLocale, pathname]);
  return <LocaleContext.Provider value={currentLocale}>{children}</LocaleContext.Provider>;
}

export function useSiteLocale() { return useContext(LocaleContext); }
