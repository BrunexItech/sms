import Image from "next/image";
import { ChatWidget } from "./ChatWidget";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function SiteShell({ children, chat = true }: { children: React.ReactNode; chat?: boolean }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      {chat && <ChatWidget />}
    </>
  );
}

/** Inner-page banner: navy field, pitch markings and the athletes photo, so every page reads as sport. */
export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-forest-950 text-white">
      <div aria-hidden className="pitch-lines absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 hidden w-[62%] md:block"
        style={{ maskImage: "linear-gradient(90deg, transparent 0%, #000 55%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 55%)" }}
      >
        <Image src="/hero/athletes.jpg" alt="" fill sizes="62vw" className="object-cover object-[60%_30%] opacity-75" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/85 to-forest-950/10" />
      <div className="mx-auto max-w-[1500px] px-5 py-14 sm:py-[72px]">
        <p className="eyebrow text-gold">{eyebrow}</p>
        <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.05] sm:text-[3.1rem]">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg text-white/75">{children}</div>}
      </div>
    </section>
  );
}
