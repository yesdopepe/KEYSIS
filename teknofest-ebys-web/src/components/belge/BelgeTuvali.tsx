import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { belgeTuruGetir } from "@/lib/belgeler/turler";
import { belgeyiOkuyabilirMi } from "@/lib/belgeler/erisim";
import { belgedenModel } from "@/lib/belgeler/modelle";
import { bekleyenOnerileriGetir } from "@/lib/belgeler/oneriler";
import { onayAdimlariGetir } from "@/lib/onay";
import { tumKurumVeBirimler } from "@/lib/cases/queries";
import { evrakYanitAdaylariGetir } from "@/app/panel/belge/actions";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import { Card } from "@/components/ui/card";
import { BelgeCalismaAlani } from "@/components/belge/BelgeCalismaAlani";
import type { BelgeKaynagi } from "@/lib/agents/belge-yazar";

/**
 * Server component that fetches session and data for a belge and delegates
 * the multi-mode editing/preview/workflow UI to BelgeCalismaAlani.
 */
export async function BelgeTuvali({ belgeId }: { belgeId: string }) {
  const session = await oturumZorunluKil();
  const [belge] = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, belgeId));
  // Not "yetkiniz yok": a belge outside this birim reads as missing so an id
  // cannot be probed for existence — the same convention sohbetGetir follows.
  if (!belge || !belgeyiOkuyabilirMi(belge, session)) {
    return (
      <Card className="p-5">
        <p className="text-sm text-destructive">Belge bulunamadı.</p>
      </Card>
    );
  }

  const yetkili = belge.birimId === session.birimId;
  const tur = belgeTuruGetir(belge.belgeTuru);
  const kaynaklar: BelgeKaynagi[] = JSON.parse(belge.kaynaklar || "[]");
  const durum = durumBilgisiGetir(belge.durum);

  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, belge.kurumId));
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, belge.birimId));
  const [yazar] = await db
    .select()
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.id, belge.olusturanKullaniciId));

  const model = belgedenModel(belge, kurum?.ad ?? "Kurum", birim?.ad, {
    adSoyad: yazar?.adSoyad ?? "",
    unvan: yazar?.unvan ?? "",
  });

  const [oneriler, onayAdimlari] = await Promise.all([
    bekleyenOnerileriGetir("belge", belge.id),
    belge.durum === "onay_zincirinde" ? onayAdimlariGetir("belge", belge.id) : Promise.resolve([]),
  ]);

  const siradakiAdim = onayAdimlari.find((a) => a.durum === "bekliyor");
  const oncekiTamam = siradakiAdim
    ? onayAdimlari.filter((a) => a.sira < siradakiAdim.sira).every((a) => a.durum === "onaylandi")
    : false;
  const benimSiram =
    yetkili && siradakiAdim && oncekiTamam && siradakiAdim.gerekliHiyerarsiSeviyesi === session.hiyerarsiSeviyesi;

  const { birimler } = belge.durum === "taslak" || belge.durum === "tamamlandi"
    ? await tumKurumVeBirimler()
    : { birimler: [] };
  const digerBirimler = birimler.filter((b) => b.id !== belge.birimId);

  const evrakAdaylari =
    yetkili && (belge.durum === "tamamlandi" || belge.durum === "onaylandi")
      ? await evrakYanitAdaylariGetir(belge.birimId)
      : [];

  return (
    <BelgeCalismaAlani
      belge={{
        id: belge.id,
        baslik: belge.baslik,
        belgeTuru: belge.belgeTuru,
        govdeMetni: belge.govdeMetni,
        durum: belge.durum,
        tarih: belge.olusturmaZamani ? new Date(belge.olusturmaZamani).toLocaleDateString("tr-TR") : undefined,
      }}
      model={model}
      turAdi={tur?.ad ?? belge.belgeTuru}
      durum={durum}
      kaynaklar={kaynaklar}
      oneriler={oneriler}
      onayAdimlari={onayAdimlari}
      yetkili={yetkili}
      benimSiram={Boolean(benimSiram)}
      siradakiAdimId={siradakiAdim?.id}
      digerBirimler={digerBirimler.map((b) => ({ id: b.id, ad: b.ad, kurumId: b.kurumId }))}
      evrakAdaylari={evrakAdaylari.map((e) => ({
        id: e.id,
        takipNo: e.takipNo,
        kayitNo: e.kayitNo,
        basvuruSahibiAdSoyad: e.basvuruSahibiAdSoyad,
      }))}
    />
  );
}
