# 10 — Operasyon ve Dağıtım

## Ön Gereksinimler

Sistemin tam işlevsellikle çalışabilmesi için üç temel servis gereklidir:

1. **Qdrant (Vektör Veritabanı):** Varsayılan olarak EVREN altyapısındaki takım örneğine bağlanır (`QDRANT_API_KEY` ve `QDRANT_PREFIX`). Çevrimdışı (offline) yerel çalışma için Docker (`docker compose up -d qdrant`) veya Windows binary (`npm run qdrant:dev`) kullanılabilir.
2. **Docling Servisi:** `services/docling-service` klasöründeki Python FastAPI OCR ve belge dönüştürme servisi (`npm run docling:dev`, port 8100).
3. **EVREN Çıkarım Servisi:** Dil modelleri ve `bge-m3-embed` gömme (embedding) servisi.

---

## Ortam Değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayınız.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `EVREN_API_KEY` | **Evet** | Model çıkarım anahtarı (`sk-evren-teamNN-XXXXXXXX`) |
| `EVREN_BASE_URL` | | Varsayılan: `https://evren-llmapi.ssyz.org.tr/v1` |
| `DATABASE_URL` | **Evet** | PostgreSQL bağlantı adresi |
| `SESSION_SECRET` | **Evet** | JWT oturum şifreleme anahtarı (en az 32 karakter) |
| `EMBEDDING_MODEL` | | Varsayılan: `bge-m3-embed` (1024 boyut) |
| `QDRANT_URL` | | Varsayılan: `https://evren-vektor.ssyz.org.tr` |
| `QDRANT_API_KEY` | | Qdrant erişim anahtarı |
| `QDRANT_PREFIX` | | Takım ön eki (ör. `team07`) |
| `DOCLING_SERVICE_URL` | | Varsayılan: `http://localhost:8100` |
| `DOCLING_SHARED_SECRET` | | Docling servis güvenlik anahtarı |
| `*_AGENT_MODEL` (×10) | | Ajan bazlı model ezme (override) ayarları |

---

## İlk Kurulum ve Çalıştırma

```bash
# 1. Ortam dosyasını oluşturun ve değişkenleri doldurun
cp .env.example .env.local

# 2. Bağımlılıkları yükleyin
npm install

# 3. Veritabanı şemasını uygulayın
npm run db:push

# 4. Demo kurum, birim, rol ve kullanıcıları yükleyin
npm run db:seed

# 5. Tohumlanan mevzuat maddelerini Qdrant'a indeksleyin
npm run db:reindex-mevzuat

# 6. Geliştirme sunucusunu başlatın
npm run dev
```

---

## Proje Betikleri (Scripts)

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Next.js geliştirme sunucusunu başlatır |
| `npm run build` | Üretim (production) derlemesini alır |
| `npm run start` | Derlenmiş üretim sunucusunu başlatır |
| `npm run lint` | ESLint ile kod kalitesi denetimi yapar |
| `npm run db:push` | Drizzle şemasını PostgreSQL veritabanına uygular |
| `npm run db:seed` | Örnek kurumlar, birimler, roller ve kullanıcıları ekler (Parola: `keysis123`) |
| `npm run db:ingest-kurumlar` | MEB ve Elazığ Valiliği mevzuat ve bilgi tabanı belgelerini toplu olarak indeksler |
| `npm run db:reindex-mevzuat` | Mevzuat külliyatını yeniden vektörleştirip Qdrant'a yükler |
| `npm run docling:dev` | Yerel Python Docling ayrıştırma servisini 8100 portunda başlatır |
| `npm run qdrant:dev` | Yerel Qdrant vektör veritabanını başlatır |

---

## Dağıtım Yönergeleri (Deploying)

* **Next.js Uygulaması:** Node.js 18+ ortamında `npm run build && npm run start` ile çalıştırılır.
* **Docling Servisi:** Docker, systemd veya Windows Servisi (NSSM) olarak 8100 portunda barındırılır.
* **PostgreSQL:** PostgreSQL 15+ sürümü veya Supabase havuzlu bağlantı kullanılır.
* **Qdrant:** Vektör veritabanı örneği.

---

## Demo Giriş Bilgileri

`npm run db:seed` çalıştırıldıktan sonra tüm demo hesaplar için parola **`keysis123`** olarak ayarlanır:

| Kullanıcı Adı | Rol / Seviye | Kurum / Birim |
| --- | --- | --- |
| `memur_fen` | Memur (Seviye 1) | Örnek Belediye / Fen İşleri |
| `mudur_fen` | Şube Müdürü (Seviye 2) | Örnek Belediye / Fen İşleri |
| `baskan_fen` | Daire Başkanı (Seviye 3) | Örnek Belediye / Fen İşleri |
| `memur_imr`, `mudur_imr` | Seviye 1, 2 | Örnek Belediye / İmar ve Şehircilik |
| `memur_nufus`, `mudur_nufus` | Seviye 1, 2 | Örnek İlçe Kaymakamlığı / Nüfus |
| `baskan_sosyal` | Seviye 3 | Örnek İlçe Kaymakamlığı / Sosyal Yardımlaşma |
| `sistem_admin` | Sistem Yöneticisi | Genel Yönetim Paneli (`/yonetim`) |

---

## Veri Depolama Yapısı (`data/`)

```
data/
├── evrak-ekleri/<ekId>/       Vatandaş başvuru ekleri
├── sohbet-ekleri/<sohbetId>/  Sohbetlere yüklenen geçici ekler
└── (Mevzuat PDF'leri ve tohumlama kaynakları)
```
