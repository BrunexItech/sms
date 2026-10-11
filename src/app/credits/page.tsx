import { PageHero, SiteShell } from "@/components/SiteShell";
import { PHOTO_CREDITS } from "@/data/photo-credits";
import { SPORT_BY_ID } from "@/data/sports";

export const metadata = { title: "Credits | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Credits" title={<>Photo &amp; data <em className="text-gold">credits.</em></>}>
        This platform is built on openly licensed photographs and open data.
      </PageHero>
      <section className="bg-bone pb-24 pt-12">
        <div className="mx-auto max-w-[1100px] space-y-6 px-5">
          <div className="-mt-8 rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="text-xl font-extrabold text-forest-900">Data</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-2">
              <li>Map tiles and facility records © <a className="font-semibold text-forest-700 underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL).</li>
              <li>Counties, sub-counties and wards: OCHA COD-AB Kenya via <a className="font-semibold text-forest-700 underline" href="https://data.humdata.org/dataset/cod-ab-ken">HDX</a> (CC BY-IGO).</li>
              <li>The hero image and crest are taken from the Ministry&apos;s design mockup supplied for this prototype and should be replaced with licensed or official artwork before launch.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="text-xl font-extrabold text-forest-900">Sport photographs (Wikimedia Commons)</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
                    <th className="py-2 pr-4">Sport</th><th className="py-2 pr-4">Author</th><th className="py-2 pr-4">Licence</th><th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {PHOTO_CREDITS.map((c) => (
                    <tr key={c.sport} className="border-b border-line/60">
                      <td className="py-2.5 pr-4 font-semibold">{SPORT_BY_ID[c.sport]?.name ?? c.sport}</td>
                      <td className="py-2.5 pr-4 text-ink-2">{c.author}</td>
                      <td className="py-2.5 pr-4 text-ink-2">{c.license}</td>
                      <td className="py-2.5"><a className="font-semibold text-forest-700 underline" href={c.page} target="_blank" rel="noreferrer">File page</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
