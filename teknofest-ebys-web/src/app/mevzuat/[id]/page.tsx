import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Scales, ArrowLeft } from "@phosphor-icons/react/ssr";
import { mevzuatMaddesiGetirGenel } from "@/lib/mevzuat";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";

/**
 * The public counterpart of /panel/mevzuat/[id] — the page a citizen's
 * citation links to.
 *
 * Citizen searches run unscoped (mevzuat is published law and a citizen
 * belongs to no institution), so their results routinely name an article the
 * panel route would refuse: /panel/** requires a session, and
 * mevzuatMaddesiGetir is kurum-scoped on top of that. Without this page a
 * cited article is either a dead link or no link at all, which is the same as
 * having no source. Read-only by construction — there is nothing to edit here
 * and no institution's identity is disclosed.
 */
export const metadata: Metadata = {
  title: "Mevzuat Maddesi — KEYSİS",
  description: "Dilekçenizde dayanak gösterilen kanun veya yönetmelik maddesinin tam metni.",
};

export default async function GenelMevzuatMaddesiSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const madde = await mevzuatMaddesiGetirGenel(id);
  if (!madde) notFound();

  return (
    <PublicShell activeHref="/basvuru/asistan">
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <Link
          href="/basvuru/asistan"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Dilekçe asistanına dön
        </Link>

        <Card className="p-6">
          <h1 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Scales size={20} className="text-primary" aria-hidden="true" />
            {madde.kodu}
          </h1>

          <h2 className="mt-2 text-sm font-semibold text-foreground">{madde.baslik}</h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {madde.icerik}
          </p>
        </Card>

        <p className="text-xs text-muted-foreground">
          Bu metin, dilekçenizde dayanak olarak gösterilen mevzuat maddesinin
          sistemde kayıtlı hâlidir. Resmî ve güncel metin için Resmî Gazete&apos;yi
          esas alınız.
        </p>
      </main>
    </PublicShell>
  );
}
