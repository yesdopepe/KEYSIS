/**
 * Seed script — run with `npm run db:seed`.
 * Populates 2 demo kurumlar (proving multi-institution routing), their
 * birimler (including a parent/child pair to prove org hierarchy),
 * yazışma şablonları (required-field schemas driving missing-info
 * detection + drafting rules), a small mevzuat corpus, and demo staff
 * users spanning all 3 hiyerarşi seviyeleri.
 */
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  kurumlar,
  birimler,
  roller,
  kullanicilar,
  yazismaSablonlari,
  mevzuatMaddeleri,
} from "./schema";

const DEMO_SIFRE_HASH = bcrypt.hashSync("ebys123", 10);

async function main() {
  console.log("Seeding...");

  // --- Kurumlar ---
  await db.insert(kurumlar).values([
    {
      id: "belediye_ornek",
      ad: "Örnek Belediye Başkanlığı",
      haberlesmeKodu: "B.10.1.TKH.0.73.00.00",
    },
    {
      id: "kaymakamlik_ornek",
      ad: "Örnek İlçe Kaymakamlığı",
      haberlesmeKodu: "B.05.4.KYM.0.16.00.00",
    },
  ]);

  // --- Birimler ---
  await db.insert(birimler).values([
    // Belediye
    { id: "belediye_ornek:YZI", kurumId: "belediye_ornek", ad: "Yazı İşleri Müdürlüğü", kod: "YZI", sdpKoduBaslangic: "805", sdpKoduBitis: "805", onayZinciriSeviyeleri: "[2]" },
    { id: "belediye_ornek:FEN", kurumId: "belediye_ornek", ad: "Fen İşleri Müdürlüğü", kod: "FEN", sdpKoduBaslangic: "200", sdpKoduBitis: "249", onayZinciriSeviyeleri: "[2,3]" },
    { id: "belediye_ornek:IMR", kurumId: "belediye_ornek", ad: "İmar ve Şehircilik Müdürlüğü", kod: "IMR", sdpKoduBaslangic: "100", sdpKoduBitis: "199", onayZinciriSeviyeleri: "[2]" },
    { id: "belediye_ornek:IMR-RUHSAT", kurumId: "belediye_ornek", ad: "Ruhsat Şube Müdürlüğü", kod: "IMR-RUHSAT", parentBirimId: "belediye_ornek:IMR", sdpKoduBaslangic: "150", sdpKoduBitis: "159", onayZinciriSeviyeleri: "[2]" },
    { id: "belediye_ornek:TEM", kurumId: "belediye_ornek", ad: "Temizlik İşleri Müdürlüğü", kod: "TEM", sdpKoduBaslangic: "250", sdpKoduBitis: "279", onayZinciriSeviyeleri: "[2]" },

    // Kaymakamlık
    { id: "kaymakamlik_ornek:YZI", kurumId: "kaymakamlik_ornek", ad: "Yazı İşleri Müdürlüğü", kod: "YZI", sdpKoduBaslangic: "805", sdpKoduBitis: "805", onayZinciriSeviyeleri: "[2]" },
    { id: "kaymakamlik_ornek:NUFUS", kurumId: "kaymakamlik_ornek", ad: "Nüfus Müdürlüğü", kod: "NUFUS", sdpKoduBaslangic: "300", sdpKoduBitis: "329", onayZinciriSeviyeleri: "[2]" },
    { id: "kaymakamlik_ornek:SOSYAL", kurumId: "kaymakamlik_ornek", ad: "Sosyal Yardımlaşma ve Dayanışma Vakfı", kod: "SOSYAL", sdpKoduBaslangic: "400", sdpKoduBitis: "429", onayZinciriSeviyeleri: "[2,3]" },
  ]);

  // --- Roller (onaySeviyesi mirrors the 3 hiyerarşi seviyeleri so
  // assigning one of these to a user reproduces today's implicit
  // behavior; daire başkanı also carries the two feature-area
  // permissions that today are hard-gated at seviye 3) ---
  await db.insert(roller).values([
    { id: "rol_memur", ad: "Memur", onaySeviyesi: 1, mevzuatYonetimi: false, bilgiTabaniYonetimi: false },
    { id: "rol_sube_muduru", ad: "Şube Müdürü", onaySeviyesi: 2, mevzuatYonetimi: false, bilgiTabaniYonetimi: false },
    { id: "rol_daire_baskani", ad: "Daire Başkanı", onaySeviyesi: 3, mevzuatYonetimi: true, bilgiTabaniYonetimi: true },
  ]);

  // --- Kullanıcılar (demo şifre hepsi: ebys123) ---
  const kullaniciListesi: Array<{
    id: string; kullaniciAdi: string; adSoyad: string;
    kurumId: string; birimId: string; hiyerarsiSeviyesi: number; unvan: string;
  }> = [
    { id: "u_memur_fen", kullaniciAdi: "memur_fen", adSoyad: "Ahmet Yılmaz", kurumId: "belediye_ornek", birimId: "belediye_ornek:FEN", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_fen", kullaniciAdi: "mudur_fen", adSoyad: "Ayşe Kaya", kurumId: "belediye_ornek", birimId: "belediye_ornek:FEN", hiyerarsiSeviyesi: 2, unvan: "Şube Müdürü" },
    { id: "u_baskan_fen", kullaniciAdi: "baskan_fen", adSoyad: "Mehmet Demir", kurumId: "belediye_ornek", birimId: "belediye_ornek:FEN", hiyerarsiSeviyesi: 3, unvan: "Daire Başkanı" },

    { id: "u_memur_imr", kullaniciAdi: "memur_imr", adSoyad: "Fatma Şahin", kurumId: "belediye_ornek", birimId: "belediye_ornek:IMR", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_imr", kullaniciAdi: "mudur_imr", adSoyad: "Ali Çelik", kurumId: "belediye_ornek", birimId: "belediye_ornek:IMR", hiyerarsiSeviyesi: 2, unvan: "Şube Müdürü" },

    { id: "u_memur_tem", kullaniciAdi: "memur_tem", adSoyad: "Zeynep Aydın", kurumId: "belediye_ornek", birimId: "belediye_ornek:TEM", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_tem", kullaniciAdi: "mudur_tem", adSoyad: "Hasan Arslan", kurumId: "belediye_ornek", birimId: "belediye_ornek:TEM", hiyerarsiSeviyesi: 2, unvan: "Şube Müdürü" },

    { id: "u_memur_yzi_bel", kullaniciAdi: "memur_yzi_bel", adSoyad: "Elif Doğan", kurumId: "belediye_ornek", birimId: "belediye_ornek:YZI", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_yzi_bel", kullaniciAdi: "mudur_yzi_bel", adSoyad: "Mustafa Koç", kurumId: "belediye_ornek", birimId: "belediye_ornek:YZI", hiyerarsiSeviyesi: 2, unvan: "Şube Müdürü" },

    { id: "u_memur_nufus", kullaniciAdi: "memur_nufus", adSoyad: "Emine Yıldız", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:NUFUS", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_nufus", kullaniciAdi: "mudur_nufus", adSoyad: "İbrahim Öztürk", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:NUFUS", hiyerarsiSeviyesi: 2, unvan: "Müdür" },

    { id: "u_memur_sosyal", kullaniciAdi: "memur_sosyal", adSoyad: "Hatice Kurt", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:SOSYAL", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_sosyal", kullaniciAdi: "mudur_sosyal", adSoyad: "Osman Aksoy", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:SOSYAL", hiyerarsiSeviyesi: 2, unvan: "Müdür" },
    { id: "u_baskan_sosyal", kullaniciAdi: "baskan_sosyal", adSoyad: "Kaymakam Yardımcısı Nurcan Bulut", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:SOSYAL", hiyerarsiSeviyesi: 3, unvan: "Kaymakam Yardımcısı" },

    { id: "u_memur_yzi_kym", kullaniciAdi: "memur_yzi_kym", adSoyad: "Serkan Polat", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:YZI", hiyerarsiSeviyesi: 1, unvan: "Memur" },
    { id: "u_mudur_yzi_kym", kullaniciAdi: "mudur_yzi_kym", adSoyad: "Derya Yavuz", kurumId: "kaymakamlik_ornek", birimId: "kaymakamlik_ornek:YZI", hiyerarsiSeviyesi: 2, unvan: "Şube Müdürü" },
  ];

  await db.insert(kullanicilar).values(
    kullaniciListesi.map((k) => ({ ...k, sifreHash: DEMO_SIFRE_HASH }))
  );

  // --- Sistem yöneticisi (super-admin) ---
  // kurumId/birimId are a placeholder to satisfy the not-null FKs — /yonetim
  // routes never check them, this account's own institution is meaningless.
  await db.insert(kullanicilar).values({
    id: "u_sistem_admin",
    kullaniciAdi: "sistem_admin",
    adSoyad: "Sistem Yöneticisi",
    sifreHash: DEMO_SIFRE_HASH,
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
    hiyerarsiSeviyesi: 1,
    unvan: "Sistem Yöneticisi",
    sistemYoneticisiMi: true,
  });

  // --- Yazışma Şablonları ---
  await db.insert(yazismaSablonlari).values([
    {
      id: "sablon_yol_bakim",
      kurumId: "belediye_ornek",
      evrakTuru: "yol_bakim_talebi",
      ad: "Yol / Kaldırım Bakım-Onarım Talebi",
      ilgiliBirimKodu: "FEN",
      gerekliAlanlar: JSON.stringify([
        { alan: "adres", aciklama: "Şikayet edilen yerin açık adresi (mahalle, cadde/sokak, kapı no)", zorunlu: true },
        { alan: "sorun_tanimi", aciklama: "Yol/kaldırımdaki sorunun net tanımı", zorunlu: true },
      ]),
      taslakKurallari:
        "Cevap yazısı; başvurunun alındığını, ilgili Fen İşleri Müdürlüğü'ne iletildiğini ve saha tespiti sonrası işlem yapılacağını belirtmeli. Resmi, kısa ve net üslup kullanılmalı.",
    },
    {
      id: "sablon_imar_durumu",
      kurumId: "belediye_ornek",
      evrakTuru: "imar_durumu_belgesi_talebi",
      ad: "İmar Durumu Belgesi Talebi",
      ilgiliBirimKodu: "IMR",
      gerekliAlanlar: JSON.stringify([
        { alan: "ada_parsel", aciklama: "Taşınmazın ada/parsel numarası", zorunlu: true },
        { alan: "mahalle", aciklama: "Taşınmazın bulunduğu mahalle", zorunlu: true },
      ]),
      taslakKurallari:
        "Cevap yazısı; talebin İmar ve Şehircilik Müdürlüğü'nce değerlendirmeye alındığını, imar durumu belgesinin hangi sürede ve nasıl teslim edileceğini belirtmeli.",
    },
    {
      id: "sablon_cop_sikayet",
      kurumId: "belediye_ornek",
      evrakTuru: "cop_toplama_sikayeti",
      ad: "Çöp Toplama Aksaklığı Şikayeti",
      ilgiliBirimKodu: "TEM",
      gerekliAlanlar: JSON.stringify([
        { alan: "adres", aciklama: "Şikayet edilen bölgenin adresi", zorunlu: true },
        { alan: "aksama_tarihi", aciklama: "Çöp toplamanın aksadığı tarih/gün", zorunlu: true },
      ]),
      taslakKurallari:
        "Cevap yazısı; şikayetin Temizlik İşleri Müdürlüğü'ne iletildiğini ve toplama programının kontrol edileceğini belirtmeli.",
    },
    {
      id: "sablon_ikametgah",
      kurumId: "kaymakamlik_ornek",
      evrakTuru: "ikametgah_talebi",
      ad: "İkametgah / Yerleşim Yeri Belgesi Talebi",
      ilgiliBirimKodu: "NUFUS",
      gerekliAlanlar: JSON.stringify([
        { alan: "tc_kimlik_no", aciklama: "T.C. Kimlik Numarası (demo amaçlı, gerçek doğrulama yapılmaz)", zorunlu: true },
        { alan: "guncel_adres", aciklama: "Güncel ikamet adresi", zorunlu: true },
      ]),
      taslakKurallari:
        "Cevap yazısı; belgenin Nüfus Müdürlüğü'nden e-Devlet veya şahsen başvuru ile alınabileceğini bilgilendirmeli.",
    },
    {
      id: "sablon_sosyal_yardim",
      kurumId: "kaymakamlik_ornek",
      evrakTuru: "sosyal_yardim_basvurusu",
      ad: "Sosyal Yardım Başvurusu",
      ilgiliBirimKodu: "SOSYAL",
      gerekliAlanlar: JSON.stringify([
        { alan: "hane_bilgisi", aciklama: "Hanede yaşayan kişi sayısı ve gelir durumu", zorunlu: true },
        { alan: "yardim_turu", aciklama: "Talep edilen yardımın türü (gıda, yakacak, nakdi vb.)", zorunlu: true },
        { alan: "iletisim_adresi", aciklama: "Ev ziyareti için adres", zorunlu: true },
      ]),
      taslakKurallari:
        "Cevap yazısı; başvurunun Sosyal Yardımlaşma ve Dayanışma Vakfı'na kaydedildiğini, ev ziyareti/inceleme sürecinin nasıl işleyeceğini belirtmeli.",
    },
  ]);

  // --- Mevzuat Korpusu (kamuya açık, paraphrase edilmiş özet metinler) ---
  await db.insert(mevzuatMaddeleri).values([
    { id: "m1", kodu: "5393/14", baslik: "Belediyenin Görev ve Sorumlulukları", kurumId: "belediye_ornek",
      icerik: "5393 sayılı Belediye Kanunu m.14 uyarınca belediye; imar, yol yapım-bakımı, temizlik, çevre sağlığı gibi mahalli müşterek nitelikteki hizmetleri yürütmekle görevlidir." },
    { id: "m2", kodu: "5393/15", baslik: "Belediyenin Yetkileri", kurumId: "belediye_ornek",
      icerik: "5393 sayılı Belediye Kanunu m.15 belediyeye; belde sakinlerinin ihtiyaçlarını karşılamak üzere alt yapı, yol, kaldırım gibi hizmetleri düzenleme ve yürütme yetkisi verir." },
    { id: "m3", kodu: "3194/21", baslik: "Yapı Ruhsatı ve İmar Durumu", kurumId: "belediye_ornek",
      icerik: "3194 sayılı İmar Kanunu m.21 uyarınca yapılacak yapılar için belediyeden yapı ruhsatı alınması, ruhsat öncesi imar durumu belgesinin düzenlenmesi zorunludur." },
    { id: "m4", kodu: "3194/32", baslik: "İmara Aykırı Yapılar", kurumId: "belediye_ornek",
      icerik: "3194 sayılı İmar Kanunu m.32, ruhsata veya eklerine aykırı yapılar hakkında belediyece yapılacak tespit ve işlemleri düzenler." },
    { id: "m5", kodu: "2872/8", baslik: "Katı Atık Yönetimi", kurumId: "belediye_ornek",
      icerik: "2872 sayılı Çevre Kanunu ve ilgili yönetmelikler uyarınca katı atıkların (çöp) düzenli toplanması ve bertarafı belediyenin yükümlülüğündedir." },
    { id: "m6", kodu: "5490/45", baslik: "Yerleşim Yeri (İkametgah) Belgesi", kurumId: "kaymakamlik_ornek",
      icerik: "5490 sayılı Nüfus Hizmetleri Kanunu uyarınca kişilerin yerleşim yeri (ikametgah) bilgisi nüfus müdürlükleri tarafından tutulur ve talep üzerine belgelendirilir." },
    { id: "m7", kodu: "3294/1", baslik: "Sosyal Yardımlaşma ve Dayanışmayı Teşvik Kanunu Amacı", kurumId: "kaymakamlik_ornek",
      icerik: "3294 sayılı Kanun, muhtaç durumdaki vatandaşlara ayni/nakdi yardım yapılması amacıyla il/ilçelerde Sosyal Yardımlaşma ve Dayanışma Vakıflarının kurulmasını düzenler." },
    { id: "m8", kodu: "3294/7", baslik: "Vakıf Yardımlarının Kapsamı", kurumId: "kaymakamlik_ornek",
      icerik: "3294 sayılı Kanun m.7 uyarınca vakıflar; gıda, yakacak, barınma, eğitim ve sağlık gibi ihtiyaçlar için muhtaçlık tespiti sonrası yardım sağlayabilir." },
    { id: "m9", kodu: "3071/3", baslik: "Dilekçe Hakkı ve Cevap Süresi", kurumId: null,
      icerik: "3071 sayılı Dilekçe Hakkının Kullanılmasına Dair Kanun uyarınca, kamu kurumlarına yapılan başvurulara en geç 30 gün içinde gerekçeli cevap verilmesi zorunludur." },
    { id: "m10", kodu: "4982/11", baslik: "Bilgi Edinme Başvurularına Yanıt Süresi", kurumId: null,
      icerik: "4982 sayılı Bilgi Edinme Hakkı Kanunu uyarınca başvurular en kısa sürede ve en geç 15 iş günü içinde, gerektiğinde 30 güne kadar uzatılarak yanıtlanır." },
  ]);

  console.log("Seed tamamlandı.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
