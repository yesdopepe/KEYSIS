/**
 * Internal (staff-authored) document type taxonomy. Distinct from the
 * citizen-originated dilekçe/şikayet flow (handled entirely by
 * lib/cases/pipeline.ts + yazışma şablonları) — these are documents staff
 * create directly: tutanak, sözleşme, karar. Each type carries a minimum
 * hiyerarşi seviyesi to author it — a memur (1) can record a tutanak, but
 * only a daire başkanı (3) can issue a karar. Authorization is enforced
 * server-side against this table, never trusted from the client.
 *
 * `icerikRehberi` is prompt guidance for the drafting agent, not a schema —
 * it names what a document of this kind conventionally covers, but the
 * agent decides the actual section headings and structure per document. A
 * routine tutanak and one covering a multi-party dispute can end up
 * organized completely differently, exactly as a person writing them by
 * hand would.
 */
export interface BelgeTuruTanimi {
  id: string;
  ad: string;
  aciklama: string;
  minHiyerarsiSeviyesi: number; // 1 = memur, 2 = şube müdürü, 3 = daire başkanı
  icerikRehberi: string;
}

export const BELGE_TURLERI: BelgeTuruTanimi[] = [
  {
    id: "tutanak",
    ad: "Tutanak",
    aciklama: "Bir olayın, tespitin veya toplantının resmi kaydı.",
    minHiyerarsiSeviyesi: 1,
    icerikRehberi:
      "Tipik olarak şunları kapsar: tutanağın hangi konuya ilişkin tutulduğu, " +
      "hazır bulunanlar, yerinde/toplantıda yapılan tespitler (kronolojik ve " +
      "somut), tespitlerin özeti ve varsa alınacak aksiyon. Belgenin " +
      "ihtiyacına göre farklı veya ek başlıklar kullanabilirsin.",
  },
  {
    id: "sozlesme",
    ad: "Sözleşme",
    aciklama: "Kurum ile bir taraf arasındaki hak ve yükümlülükleri belirleyen belge.",
    minHiyerarsiSeviyesi: 2,
    icerikRehberi:
      "Tipik olarak şunları kapsar: taraflar (kimlik/unvan bilgileriyle), " +
      "sözleşmenin konusu, tarafların karşılıklı yükümlülükleri, süre ve " +
      "fesih şartları, yürürlük tarihi. Belgenin ihtiyacına göre farklı veya " +
      "ek başlıklar kullanabilirsin.",
  },
  {
    id: "karar",
    ad: "Karar",
    aciklama: "Kurum adına bağlayıcı, resmi bir idari karar.",
    minHiyerarsiSeviyesi: 3,
    icerikRehberi:
      "Tipik olarak şunları kapsar: kararın hangi mevzuata dayandığı, " +
      "konunun gerekçeli değerlendirmesi, bağlayıcı ve tek anlamlı karar " +
      "metni, kararın ne zaman yürürlüğe gireceği ve kime tebliğ edileceği. " +
      "Belgenin ihtiyacına göre farklı veya ek başlıklar kullanabilirsin.",
  },
];

export function belgeTuruGetir(id: string): BelgeTuruTanimi | undefined {
  return BELGE_TURLERI.find((t) => t.id === id);
}

/** Types a staff member at the given hiyerarşi seviyesi is allowed to author. */
export function izinliBelgeTurleri(hiyerarsiSeviyesi: number): BelgeTuruTanimi[] {
  return BELGE_TURLERI.filter((t) => hiyerarsiSeviyesi >= t.minHiyerarsiSeviyesi);
}
