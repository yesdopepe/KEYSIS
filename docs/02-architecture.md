# 02 — Mimari

## Çalışma Zamanı Topolojisi

Sistem dört ana süreçten oluşur. Next.js uygulaması tüm diğer bileşenlerle doğrudan iletişim kuran merkezi katmandır.

```
                          ┌─────────────────────────────┐
   Tarayıcı ──────────────│  Next.js 16 (App Router)    │
   (Vatandaş / Personel)  │  RSC + Server Actions       │
                          │  Akışlı Sohbet API Rotaları │
                          └──┬────────┬────────┬────────┘
                             │        │        │
              ┌──────────────┘        │        └──────────────┐
              │                       │                       │
   ┌──────────▼─────────┐  ┌──────────▼────────┐  ┌───────────▼──────────┐
   │  PostgreSQL        │  │  Qdrant           │  │  EVREN Çıkarım Serv. │
   │  Ana Veri Kaynağı  │  │  Vektör İndeksi   │  │  LLM + Gömme (Embed) │
   │  (Drizzle ORM)     │  │  3 Koleksiyon     │  │  (OpenAI Uyumlu)     │
   │                    │  │                   │  │                      │
   └────────────────────┘  └───────────────────┘  └──────────────────────┘
                             │
                  ┌──────────▼───────────┐
                  │  Docling Servisi     │   Python / FastAPI
                  │  POST /convert       │   PDF·DOCX·Görsel → Markdown
                  └──────────────────────┘
```

Yerel diskte `./data/` dizini altında yüklenen dosyalar saklanır (`evrak-ekleri/`, `sohbet-ekleri/`). Güvenlik amacıyla hiçbir dosya doğrudan statik `public/` dizininden sunulmaz; her dosya indirme isteği yetki kontrolü yapan güvenli rotalardan geçer.

---

## Gerçeğin Tek Kaynağı Kuralı (Source of Truth)

**Tüm metin ve ilişkisel üst verilerin mutlak sahibi PostgreSQL'dir. Qdrant yalnızca bir arama indeksidir.** Tüm veri yazma süreçleri katı bir işlem sırasını ve hata geri alma (rollback) disiplinini takip eder:

1. Veri satırları PostgreSQL'e yazılır (Qdrant nokta kimliği, tablodaki UUID ile birebir aynıdır).
2. Metin vektörleştirilir ve Qdrant'a yüklenir.
3. İkinci adımda hata oluşursa, **ilk adımda veritabanına yazılan satırlar derhal silinir (rollback)** ve kullanıcıya hata döndürülür.

Bu mekanizma indeks tutarsızlıklarını önler: Arayüzde listelenen ancak vektör veritabanında bulunmayan bir belge, yapay zekânın o belgeden habersiz yanıt vermesine neden olur. Benzer şekilde silme işlemleri de simetriktir: Bir bilgi tabanı belgesi veya mevzuat maddesi silindiğinde, vektörleri de Qdrant'tan temizlenir.

---

## Neden Server Actions Ağırlıklı Mimari?

Sistemdeki neredeyse tüm veri mutasyonları geleneksel REST API'ler yerine **Next.js Server Actions** ile yürütülür. `src/app/api/**` altındaki rotalar yalnızca Server Actions'ın teknik olarak karşılayamadığı şu özel durumlarda kullanılır:

* **Akışlı (Streaming) Yanıtlar:** `/api/asistan` ve `/api/basvuru/asistan` rotaları, istemcinin jeton jeton (token-by-token) tükettiği `UIMessageStream` döndürür.
* **İkili (Binary) Dosya İndirmeleri:** Dışa aktarım rotaları (`/disa-aktar`), `Content-Disposition` başlığı ile dosya akışı sağlar.
* **Yetkilendirilmiş Dosya Sunumu:** Ek belgelerin sadece hak sahibi kullanıcılara güvenli iletilmesi.

Bunun dışındaki tüm işlemler (onaylama, havale etme, taslak kaydetme, öneri kabulü vb.), formlar veya istemci bileşenlerinden doğrudan çağrılan `"use server"` fonksiyonlarıdır.

---

## Güven ve Yetki Sınırları

1. **İstemci → Sunucu Güven Sınırı:** Tarayıcıdan gelen hiçbir kimlik bilgisine doğrudan güvenilmez. Bir sohbet kaydı sadece `id` ile değil; `(id, kullaniciId, kurumId)` üçlüsü ile sorgulanır. Belge erişimleri `belgeyiOkuyabilirMi` yetki denetiminden geçer.
2. **Model → Veri Güven Sınırı:** Vektör sorgularında kullanılan `kurumId`, LLM'in ürettiği parametrelerden değil, doğrulanmış kullanıcı oturumundan (session) alınır. Yapay zekâ aracı kendi yetki kapsamını genişletemez; `ara()` fonksiyonu kurum filtresini zorunlu kılar.
3. **Model Çıktısı → Kullanıcı Güven Sınırı:** Canlı sohbette model çıktıları arayüze ulaşmadan önce iki özel filtreleme akışından geçer: Biri modelin iç muhakeme artıklarını temizler, diğeri ise modelin o adımda çağırmadığı bir araca/bağlantıya uydurma (halüsinasyon) atıf yapmasını engeller.

---

## İstek Akışı: Vatandaş Başvuru Hattı

```
POST (Server Action) basvuruGonder
  ├─ Ek dosyaları ./data/evrak-ekleri/<ekId>/ altına kaydet
  ├─ Metin çıkarımı → Docling /convert (önce hızlı düz metin, gerekirse OCR)
  ├─ Yanıtlanan dinamik alanları dilekçe gövdesine yerleştir
  └─ basvuruIsle()                                       (lib/cases/pipeline.ts)
       ├─ Doldurulmamış "[EK BİLGİ GEREKLİ: ...]" alanı kaldıysa işlemi durdur
       ├─ Düzeltilmiş metin 40 karakterden kısaysa reddet
       ├─ siniflandirDilekce()  Router Ajanı → (kurum, birim, evrakTuru, güvenSkoru)
       ├─ eksikBilgiTespitEt()  Eşleşen şablona göre zorunlu alan kontrolü
       │    └─ Eksik bilgi varsa → Durdur, kullanıcıya form üzerinde anlık sor
       ├─ evrakiOku()           Reader Ajanı  → Özet, aciliyet, ilgili mevzuat
       │    └─ mevzuatAraVektor() → Qdrant en iyi 6 eşleşme → Model hangisinin geçerli olduğunu seçer
       ├─ ekleriAnalizEt()      Ek Belge Ajanı → Tutarlılık ve çapraz doğrulama
       ├─ yeniKayitNo()         Atomik sayaç ile resmi SDP formatında sayı üretimi
       └─ INSERT evraklar (durum = "ic_incelemede") + evrakEkleri + auditLog
```

---

## İstek Akışı: Personel Sohbet Akışı

```
POST /api/asistan
  ├─ Oturumu doğrula; oturum yoksa veya referer /basvuru/asistan ise → Vatandaş personası
  ├─ Model seçimi: Mesajlarda görsel varsa → asistan_gorsel_agent modelini kullan
  ├─ Sistem promptu: prompts/asistan-agent.md (kurum/birim/kullanıcı/izinli belge türleri ile doldurulur)
  ├─ streamText({ tools: 10, stopWhen: stepCountIs(8), transformStream... })
  └─ onEnd → Mesaj geçmişini kaydet; ilk mesajda otomatik başlık üret
```

---

## Hata Durumu ve Geri Dönüş (Fallback) Stratejisi

| Ajan | Hata Durumunda İzlenen Yol |
| --- | --- |
| **Router** | Sözlüksel (lexical) benzerlik aramasına geri döner, güven skoru 0.6 ile sınırlandırılır |
| **Reader** | **Varsayılan içerik üretmez** — `ozet: null`, mevzuat eşleşmesi boş bırakılır ve loglanır |
| **Writer** | Standart şablonlu resmi alındı yazısı taslağı oluşturur ve loglara not düşer |
| **Eksik Bilgi** | Eksik alan olmadığını varsayar — altyapı hatası sebebiyle vatandaş başvurusu bloke edilmez |
| **Belge Yazarı** | Gövde metni `[EK BİLGİ GEREKLİ: Bu belge yapay zekâ tarafından oluşturulamadı]` olarak açılır |
