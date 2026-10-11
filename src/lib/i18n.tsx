"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type Lang = "en" | "sw";

const dict = {
  "nav.home": { en: "Home", sw: "Mwanzo" },
  "nav.registration": { en: "Registration", sw: "Usajili" },
  "nav.act": { en: "Sports Act", sw: "Sheria ya Michezo" },
  "nav.facilities": { en: "Facilities", sw: "Vituo vya Michezo" },
  "nav.directory": { en: "Directory", sw: "Orodha" },
  "nav.payments": { en: "Payments", sw: "Malipo" },
  "nav.login": { en: "Login", sw: "Ingia" },
  "nav.contact": { en: "Contact", sw: "Wasiliana" },
  "hero.eyebrow": {
    en: "National Sports Registration Platform",
    sw: "Jukwaa la Kitaifa la Usajili wa Michezo",
  },
  "hero.title.a": { en: "Every club.", sw: "Kila klabu." },
  "hero.title.b": { en: "Every field.", sw: "Kila uwanja." },
  "hero.title.c": { en: "One national record.", sw: "Rekodi moja ya taifa." },
  "hero.sub": {
    en: "Register your club, team or sports organisation in compliance with the Sports Act 2013, and trace every sports facility across Kenya's 47 counties.",
    sw: "Sajili klabu, timu au shirika lako la michezo kwa mujibu wa Sheria ya Michezo 2013, na ufuatilie kila kituo cha michezo katika kaunti zote 47 za Kenya.",
  },
  "hero.cta.register": { en: "Start registration", sw: "Anza usajili" },
  "hero.cta.map": { en: "Explore facilities", sw: "Tazama vituo" },
  "search.county": { en: "County", sw: "Kaunti" },
  "search.sport": { en: "Sport", sw: "Mchezo" },
  "search.go": { en: "Find facilities", sw: "Tafuta vituo" },
} as const;

export type DictKey = keyof typeof dict;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
}

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (k) => dict[k][lang] }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}
