"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";

type Msg = { from: "bot" | "me"; text: string };

function useAssistant() {
  const { lang, setLang } = useLang();
  const { state } = useStore();
  const [log, setLog] = useState<Msg[]>([]);
  const fee = state.fees;
  const L = (en: string, sw: string) => (lang === "sw" ? sw : en);

  const intents: [RegExp, string][] = [
    [/fee|cost|pay|price|bei|ada|lipa|malipo/i, L(`Registration fees: Clubs KSh ${fee.Club.toLocaleString()}; every other category KSh ${fee["Player / Sportsperson"].toLocaleString()}. Pay by M-Pesa, card or mobile money on the Register or Payments page.`, `Ada za usajili: Klabu KSh ${fee.Club.toLocaleString()}; makundi mengine KSh ${fee["Player / Sportsperson"].toLocaleString()}. Lipa kwa M-Pesa, kadi au pesa za simu.`)],
    [/who|approve|review|decid|nani|idhini/i, L("Your County Sports Officer reviews first, your federation endorses membership, and the Sports Registrar makes the final decision and issues your certificate.", "Afisa wa Michezo wa Kaunti hukagua kwanza, shirikisho linaidhinisha uanachama, kisha Msajili wa Michezo anatoa uamuzi na cheti.")],
    [/status|track|where|application|hali|fuatilia/i, L("Open Login, enter your email, phone or reference, and My account shows every step your application has been through.", "Fungua Ingia, weka barua pepe, simu au namba ya marejeo ili uone hatua zote za ombi lako.")],
    [/cert|verify|genuine|cheti|thibitisha/i, L("Anyone can check a certificate on the Verify page using its number.", "Mtu yeyote anaweza kuthibitisha cheti kwenye ukurasa wa Verify kwa kutumia namba yake.")],
    [/facilit|stadium|map|pitch|uwanja|kituo|ramani/i, L("Open Facilities to search any place in Kenya, filter by county, sub-county or ward, or register a facility by placing it on the map.", "Fungua Facilities kutafuta mahali popote Kenya, kuchuja kwa kaunti, kaunti ndogo au wadi, au kusajili kituo kwa kukiweka kwenye ramani.")],
    [/doc|require|need|id|kra|constitution|hitaji|nyaraka/i, L("You need your full legal names, National ID or passport, KRA PIN, phone and email. Clubs also give the chairperson and secretary.", "Unahitaji majina kamili, kitambulisho au pasipoti, KRA PIN, simu na barua pepe. Klabu pia hutoa mwenyekiti na katibu.")],
    [/regist|club|team|join|sajili|klabu|timu/i, L("Start with Register. It takes four steps: personal details, location, sports details, then payment.", "Anza na Register. Ni hatua nne: taarifa binafsi, eneo, maelezo ya mchezo, kisha malipo.")],
  ];

  const greeting = L(
    "Hello! I am here to guide you through the registration process.",
    "Habari! Nipo hapa kukuongoza katika mchakato wa usajili.",
  );

  const send = (q: string) => {
    const text = q.trim();
    if (!text) return;
    const a =
      intents.find(([r]) => r.test(text))?.[1] ??
      L("I can help with registration, fees, required documents, approvals and finding facilities. Try asking about one of those.", "Naweza kusaidia kuhusu usajili, ada, nyaraka, idhini na vituo. Jaribu kuuliza mojawapo.");
    setLog((l) => [...l, { from: "me", text }, { from: "bot", text: a }]);
  };

  return { lang, setLang, log, greeting, send, L };
}

/** The "Sports Assistant" card from the mockup, usable inline or inside the floating widget. */
export function AssistantPanel({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, log, greeting, send, L } = useAssistant();
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [log]);

  return (
    <section className={`rounded-2xl border border-forest-500/30 bg-white p-4 shadow-[0_18px_40px_-28px_rgba(6,45,87,0.5)] ${compact ? "" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-forest-100 to-white text-forest-700 ring-1 ring-forest-500/20">
          <Bot size={30} strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-forest-900">{L("Sports Assistant", "Msaidizi wa Michezo")}</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{greeting}</p>
          <div className="mt-2.5 flex gap-2">
            {(["en", "sw"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${lang === l ? "bg-forest-800 text-white" : "bg-forest-100 text-forest-800 hover:bg-forest-100/70"}`}
              >
                {l === "en" ? "English" : "Swahili"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-bone p-2.5">
          {log.map((m, i) => (
            <p key={i} className={`max-w-[92%] rounded-xl px-3 py-2 text-[13px] ${m.from === "bot" ? "bg-white text-ink" : "ml-auto bg-forest-800 text-white"}`}>
              {m.text}
            </p>
          ))}
          <div ref={end} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
          setInput("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={L("Type your message...", "Andika ujumbe wako...")}
          className="min-w-0 flex-1 rounded-lg border border-line px-3.5 py-2.5 text-sm outline-none focus:border-forest-700 focus:ring-4 focus:ring-forest-700/10"
        />
        <button aria-label="Send" className="grid h-11 w-11 place-items-center rounded-lg bg-forest-700 text-white transition hover:bg-forest-800">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

/** Floating assistant for inner pages. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-[60] print:hidden">
      {open && (
        <div className="step-anim mb-3 w-[min(92vw,380px)]">
          <div className="relative">
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="absolute -top-3 -right-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-forest-900 text-white shadow-lg">
              <X size={15} />
            </button>
            <AssistantPanel compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Sports Assistant"
        className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-forest-700 to-forest-900 text-white shadow-[0_14px_30px_-8px_rgba(6,45,87,0.7)] ring-4 ring-white transition hover:scale-105"
      >
        {open ? <X size={22} /> : <Bot size={26} />}
      </button>
    </div>
  );
}
