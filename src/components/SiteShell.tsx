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
  photo,
  plain = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Full-width photograph instead of the default athletes banner. */
  photo?: { src: string; position?: string };
  /** Slim title bar with no photograph, for signed-in working pages. */
  plain?: boolean;
}) {
  if (plain)
    return (
      <section className="relative isolate overflow-hidden bg-forest-950 text-white">
        <div aria-hidden className="pitch-lines absolute inset-0 -z-10 opacity-60" />
        <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-8">
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h1 className="font-display mt-2 text-[1.5rem] leading-tight sm:text-[1.75rem]">{title}</h1>
          {children && <div className="mt-1.5 max-w-2xl text-sm text-white/70">{children}</div>}
        </div>
      </section>
    );
  return (
    <section className="relative isolate overflow-hidden bg-forest-950 text-white">
      {photo ? (
        <>
          <Image src={photo.src} alt="" fill priority sizes="100vw" style={{ objectPosition: photo.position ?? "50% 50%" }} className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/70 to-forest-950/15 max-sm:from-forest-950/85 max-sm:via-forest-950/65 max-sm:to-forest-950/35" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-forest-950/60 to-transparent" />
        </>
      ) : (
        <div aria-hidden className="pitch-lines absolute inset-0 -z-10" />
      )}
      {!photo && <div
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 hidden w-[62%] md:block"
        style={{ maskImage: "linear-gradient(90deg, transparent 0%, #000 55%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 55%)" }}
      >
        <Image src="/hero/athletes.jpg" alt="" fill sizes="62vw" className="object-cover object-[60%_30%] opacity-75" />
      </div>}
      {!photo && <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/85 to-forest-950/10" />}
      <div className={`mx-auto max-w-[1500px] px-5 ${photo ? "py-20 sm:py-[110px]" : "py-14 sm:py-[72px]"}`}>
        <p className="eyebrow text-gold">{eyebrow}</p>
        <h1 className="font-display mt-3 max-w-3xl text-[1.75rem] leading-[1.15] sm:text-[2.25rem]">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-base text-white/75">{children}</div>}
      </div>
    </section>
  );
}
