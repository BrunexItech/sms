import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Home hero: Kenyan athletes across sports, headline and call to action, as in the Ministry mockup. */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-forest-950 text-white">
      <Image
        src="/hero/athletes.jpg"
        alt="Kenyan athletes in football, athletics, rugby, netball and swimming"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[70%_25%]"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/80 to-forest-950/5" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-forest-950/70 to-transparent" />

      <div className="mx-auto max-w-[1500px] px-5 pb-[84px] pt-9 sm:pt-11">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold ring-1 ring-white/15 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> National Sports Digital Registry
        </p>
        <h1 className="mt-4 max-w-[560px] text-[clamp(2rem,4vw,3.35rem)] font-black uppercase leading-[1] tracking-tight">
          National Sports
          <br />
          Management
          <br />
          <span className="text-gold">Platform</span>
        </h1>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold">
          Register <i className="text-gold">•</i> Manage <i className="text-gold">•</i> Develop <i className="text-gold">•</i> Grow Kenyan Sports
        </p>
        <p className="mt-2 max-w-xl text-[15px] text-white/80">
          A unified platform for all sports stakeholders in Kenya in line with the Sports Act.
        </p>
        <Link
          href="/register"
          className="group mt-7 inline-flex items-center gap-2.5 rounded-lg bg-gold px-7 py-3.5 text-[15px] font-extrabold text-forest-950 shadow-[0_16px_30px_-14px_rgba(245,180,0,0.9)] transition hover:brightness-105"
        >
          Get Started <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
