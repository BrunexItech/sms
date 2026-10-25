import Image from "next/image";

/** Crest cropped from the Ministry's design mockup. Replace with the official asset file when available. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/brand/crest.png" alt="" width={52} height={52} className="h-[52px] w-auto object-contain" priority />
      <div className="leading-tight">
        <p className={`text-[17px] font-bold tracking-tight ${light ? "text-white" : "text-forest-900"}`}>MINISTRY OF SPORTS</p>
        <p className={`text-[11px] font-medium tracking-wide ${light ? "text-white/70" : "text-ink-3"}`}>REPUBLIC OF KENYA</p>
      </div>
    </div>
  );
}
