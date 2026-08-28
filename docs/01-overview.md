# 01 — Genel Bakış

## Bu Sistem Nedir?

**KEYSİS** (Kapsamlı Evrak Yönetim Sistemi), Türkiye Cumhuriyeti kamu kurum ve kuruluşları için tasarlanmış, üzerinde çoklu yapay zekâ ajan katmanı barındıran akıllı bir Elektronik Belge Yönetim Sistemidir (EBYS).

Vatandaş hesap açma zorunluluğu olmadan dilekçesini sisteme sunar; yapay zekâ ajan katmanı başvuruyu analiz eder, doğru kuruma ve birime yönlendirir, yürürlükteki mevzuatla ilişkilendirir, eksik bilgileri tespit eder ve resmi bir cevap yazısı taslağı üretir. Ardından tüm kritik adımlar yetkili kamu personeli ve amirlerin onayına sunulur.

Tasarımın değişmez temel ilkesi: **"Ajanlar önerir, insanlar karar verir."** Hiçbir yapay zekâ aracı bir evrağı kendiliğinden onaylayamaz, havale edemez, belgeyi kesinleştiremez veya doğrudan değişiklik uygulayamaz. Bu işlemler yalnızca yetkilendirilmiş personelin onayıyla gerçekleşir.

---

## İki Ana Kullanıcı Yolculuğu

### 1. Vatandaş Yolculuğu (Giriş / Hesap Gerekmez)

```
/basvuru/asistan   Asistanla sohbet → 3071 sayılı Kanuna uygun dilekçe taslağı tuvalde hazırlanır
       ↓
/basvuru           Başvuru gönderimi: Ad-soyad, iletişim, dilekçe metni, ek belgeler
       ↓           ── AI: Sınıflandırma → Zorunlu alan kontrolü → (Eksik bilgi varsa talep) →
                      Mevzuat eşleştirme → Ek belge analizi → Evrak kaydı & sayı üretimi
       ↓
   takip no        8 karakterli güvenli takip kodu (kolay okunabilir, harf/sayı karışıklığı önlenmiş)
       ↓
/basvuru/durum     Durum takibi; cevaplandığında resmi yanıt yazısını PDF / DOCX / UDF olarak indirme
```

### 2. Kurum Personeli Yolculuğu (Kimlik Doğrulamalı)

```
/giris             Personel girişi (Kullanıcı adı + parola) → JWT oturum çerezi
      ↓
/panel             Gösterge paneli: İncelenecek evraklar, kendi onayını bekleyen işler, gönderilenler
      ↓
/panel/evrak/[id]
      ├─ HITL #1   Yapay zekâ sınıflandırma ve analizini onayla → Writer ajanını tetikler
      │            veya evrağı doğrudan doğru birime havale et
      ├─ Hazırlanan resmi yazı taslağını doğrudan düzenle veya yapay zekâdan revizyon iste (öneri olarak gelir)
      └─ HITL #2   Sıralı onay zinciri: Tanımlı her hiyerarşi seviyesi sırayla onaylar
                   → Son amir onayı ile resmi yanıt vatandaşa iletilir
/panel/asistan     Kurum içi bilgi tabanı ve mevzuat destekli personel asistanı;
                   yan paneldeki tuvalde tutanak / sözleşme / karar taslakları üretir
/yonetim           Sistem yönetimi: Kurumlar, birimler, roller ve kullanıcı yetkilendirmesi
```

---

## İki Belge Ailesi, Tek Çıktı Hattı

| Özellik | **evrak** (Vatandaş Başvurusu) | **belge** (Kurum İçi Personel Belgesi) |
| --- | --- | --- |
| Kaynağı | `/basvuru` formu üzerinden | Kurum asistanı `belgeTaslagiHazirla` aracı |
| Türleri | `yazismaSablonlari` satırlarına göre | `dilekce`, `tutanak`, `sozlesme`, `karar` |
| Cevap Metni Konumu | `evraklar.taslakYapisi` (JSON `YanitTaslagi`) | `belgeler.govdeMetni` |
| Onay Mekanizması | `onayAdimlari` (`hedefTuru = "evrak"`) | `onayAdimlari` (`hedefTuru = "belge"`) |
| Yapay Zekâ Önerileri | `belgeOnerileri` (`hedefTuru = "evrak"`) | `belgeOnerileri` (`hedefTuru = "belge"`) |
| Nihai Durum | `gonderildi` | `onaylandi` |

Her iki belge ailesi de `src/lib/belgeler/resmi-belge.ts` içerisindeki tek bir kanonik modelde (`ResmiBelge`) birleşir. Bu sayede ekran önizlemesi, PDF çıktısı, DOCX ve UDF dışa aktarımı kurumsal standartta aynı görsel yapıyı üretir. Alan sıralaması ve biçimlendirme *Resmî Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik* kurallarına tam uyumludur.

---

## Teknoloji Yığını

| Katman | Teknoloji / Kütüphane | Notlar |
| --- | --- | --- |
| Çerçeve (Framework) | Next.js 16 (App Router), React 19 | Server Components + Server Actions mimarisi |
| Dil | TypeScript 5 (Strict Mode) | Tam tip güvenliği |
| Veritabanı | PostgreSQL (Drizzle ORM, `postgres-js`) | `prepare: false` desteği ile bağlantı havuzu uyumlu |
| Vektör Veritabanı | Qdrant | 3 ayrı koleksiyon; kurum bazlı filtreleme |
| LLM ve Gömme (Embedding) | EVREN Çıkarım Servisi (OpenAI uyumlu) | `@ai-sdk/openai-compatible`; `bge-m3-embed` (1024 boyut) |
| Ajan SDK | Vercel AI SDK v7 (`ai`) | `generateObject` / `streamObject` / `streamText` + araçlar |
| Belge Ayrıştırma | Docling Servisi (Python / FastAPI) | PDF, DOCX ve taranmış belgeler için yerel OCR ve Markdown dönüşümü |
| Kimlik Doğrulama | `jose` JWT (httpOnly çerez) + `bcryptjs` | 8 saatlik oturum süresi, rol bazlı yetkilendirme |
| Belge Dışa Aktarımı | `@react-pdf/renderer`, `docx`, `fflate` (UDF) | UDF = UYAP Doküman Formatı (`content.xml` tabanlı ZIP) |
| Arayüz (UI) | Tailwind CSS v4, shadcn temelleri, Base UI, Phosphor Icons | `Lexend` başlıklar / `Source Sans 3` gövde / `Tinos` resmi yazışma fontu |

---

## Proje Dizin Yapısı

```
teknofest/
├── AGENTS.md                     Geliştirme yol haritası ve durum takibi
├── docs/                         Sistem teknik dokümantasyonu (bu klasör)
└── teknofest-ebys-web/           Ana web uygulaması ve servisler
    ├── prompts/                  Ajan sistem promptları (.md dosyaları halinde)
    ├── services/docling-service/ Python FastAPI belge dönüştürme mikroservisi
    ├── assets/fonts/             PDF üretimi için Tinos font dosyaları
    ├── data/                     Yüklenen ekler (evrak-ekleri/, sohbet-ekleri/) ve külliyat
    └── src/
        ├── app/                  Next.js App Router (sayfalar, Server Actions, API rotaları)
        │   ├── api/              Akışlı sohbet, dosya sunumu, dışa aktarım uç noktaları
        │   ├── basvuru/          Vatandaş başvuru ve sorgulama arayüzü
        │   ├── panel/            Personel ve amir çalışma paneli
        │   ├── yonetim/          Sistem yönetimi paneli
        │   └── giris/            Personel giriş sayfası
        ├── components/
        │   ├── ui/               Tasarım sistemi bileşenleri
        │   ├── ai-elements/      Ajan sohbet ve akış bileşenleri (mesaj, araç, düşünce akışı)
        │   ├── belge/            Belge tuvali, editör, önizleme ve dışa aktarım araçları
        │   ├── sohbet/           Sohbet düzeni ve girdi alanı
        │   └── basvuru/          Vatandaş asistanı bileşenleri
        ├── lib/
        │   ├── agents/           Yapılandırılmış çıktı üreten 6 ajan
        │   ├── ai/               Model konfigürasyonu, sağlayıcı istemcisi, prompt yükleyici
        │   ├── auth/             Oturum yönetimi ve hiyerarşi yetki kontrolleri
        │   ├── belgeler/         Resmi belge modeli, görsel önizleme, dışa aktarıcılar
        │   ├── cases/            Vatandaş başvuru hattı, SDP sayı üretimi, sorgular
        │   ├── bilgi-tabani/     Kurum bilgi tabanı (parçalama, vektörleme, arama)
        │   ├── mevzuat/          Mevzuat külliyatı (madde ayrıştırma ve RAG)
        │   ├── onay/             Ortak onay zinciri ve havale motoru
        │   ├── sohbet/           Sohbetler, mesajlar ve ekler
        │   ├── vektor/           Qdrant istemcisi ve koleksiyon yönetimi
        │   ├── db/               Drizzle şeması, veritabanı istemcisi ve tohum verileri
        │   └── docling/          Docling ayrıştırma servisi HTTP istemcisi
        └── scripts/              Toplu veri yükleme ve indeksleme bakım betikleri
```

---

## Kapsam Sınırları

Yarışma şartnamesi ve MVP kapsamı doğrultusunda şu özellikler kapsam dışı bırakılmıştır:
Kriptografik e-imza altyapısı, EYP (e-Yazışma Paketi) üretimi, KEP / DETSİS entegrasyonu, saklama ve imha planları, gizlilik derecesi yönetimi ve harici kurumlar arası resmi ağ gönderimi. Sistem içerisindeki `havale` işlemi, kayıtlı kurum ve birimler arasındaki iç yönlendirmeyi temsil eder.
