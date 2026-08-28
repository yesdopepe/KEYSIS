# 03 — Veri Modeli

Veritabanı Şeması: `src/lib/db/schema.ts` (Drizzle ORM, PostgreSQL).
Toplam 19 tablo bulunmaktadır. Tüm zaman damgaları `timestamptz` türündedir. Esnek veri yapıları için JSON alanları `text` veya JSONB formatında saklanır.

---

## Varlık İlişki Haritası (Entity Map)

```
kurumlar ─┬─< birimler (parentBirimId ile hiyerarşik ağaç yapısı)
          │      └─< kullanicilar >── roller
          ├─< yazismaSablonlari        (kurum × evrakTuru bazında)
          ├─< mevzuatMaddeleri         (kurumId NULL ise genel mevzuat külliyatı)
          ├─< kurumBelgeleri ──< kurumBelgeParcalari
          ├─< evrakSayaclari           (1:1, resmi SDP sayı sayacı)
          ├─< evraklar ──< evrakEkleri
          ├─< belgeler
          └─< sohbetler ─┬─< sohbetMesajlari
                         └─< sohbetEkleri

(hedefTuru ∈ {evrak, belge}, hedefId) üzerinde polimorfik tablolar:
   onayAdimlari · havaleler · belgeOnerileri
```

Bu polimorfik tablolar sayesinde vatandaş başvuru cevabı (`evrak`) ile kurum içi personel belgesi (`belge`), iki ayrı onay sistemi yerine tek ve tutarlı bir onay motorunu paylaşır.

---

## Kurumsal Yapı ve Kimlik

### `kurumlar` — Kamu Kurumları
`id` · `ad` · `haberlesmeKodu` (`B.10.1.TKH.0.73.00.00` formatındaki resmi kurum kodu) · `aciklama` · `createdAt`.
Sistemdeki ana kiracı (tenant) sınırıdır. Kurum bazlı tüm sorgular bu ID üzerinden filtrelenir.

### `birimler` — İdari Birimler / Müdürlükler
`id` (`<kurumId>:<kod>`) · `kurumId` · `ad` · `kod` · `parentBirimId` (hiyerarşik teşkilat yapısı) · `sdpKoduBaslangic` / `sdpKoduBitis` (bu birimin baktığı SDP aralığı) · **`onayZinciriSeviyeleri`** · `aciklama`.
* `onayZinciriSeviyeleri`: Sırasıyla onay vermesi gereken hiyerarşi seviyelerini içeren JSON dizisi (ör. `"[2]"` = yalnızca şube müdürü; `"[2,3]"` = önce şube müdürü, ardından daire başkanı).
* `unique(kurumId, kod)` kısıtı bulunur.

### `roller` — Kullanıcı Rolleri
`ad` · `aciklama` · `onaySeviyesi` (null ise bu rol onay zincirine katılmaz) · `mevzuatYonetimi` · `bilgiTabaniYonetimi`.

### `kullanicilar` — Personel Hesapları
`kullaniciAdi` (benzersiz) · `sifreHash` (bcrypt) · `adSoyad` · `kurumId` · `birimId` · **`hiyerarsiSeviyesi`** (1: Memur, 2: Şube Müdürü, 3: Daire Başkanı / Kurum Amiri) · `unvan` · `rolId` · `sistemYoneticisiMi` · `aktifMi`.
Kullanıcılar silinmez, erişim yetkisi `aktifMi = false` yapılarak iptal edilir.

---

## Yönlendirme ve Bilgi Yönetimi

### `yazismaSablonlari` — Yazışma Şablonları
`kurumId` · `evrakTuru` · `ad` · **`gerekliAlanlar`** (JSON `Array<{alan, aciklama, zorunlu}>`) · **`taslakKurallari`** · `ilgiliBirimKodu`.
Bu tablo hem Eksik Bilgi Ajanının zorunlu alan kontrolünü hem de Writer Ajanının resmi üslup kurallarını belirler.

### `mevzuatMaddeleri` — Mevzuat Maddeleri
`kodu` (ör. `5393/15`) · `baslik` · `icerik` · `kurumId` (**NULL ise tüm kurumlara açık genel kanundur**) · `createdAt`.
Birim bazında sabit boyutlu parçalama yerine doğrudan atıf yapılan *madde* düzeyinde saklanır.

### `kurumBelgeleri` / `kurumBelgeParcalari` — Kurum Bilgi Tabanı
Kurum yöneticilerinin yüklediği iç yönergeler, genelgeler ve prosedür belgeleri ile bunların vektör parçalarıdır. `kurumId` her parçaya doğrudan yazılır, böylece kurumlar arası veri sızıntısı engellenir.

---

## Vatandaş Evrak Kayıtları

### `evraklar` — Başvurular
| Sütun | Açıklama |
| --- | --- |
| `takipNo` | Vatandaşa verilen 8 haneli benzersiz sorgulama kodu (`0/O/1/I` harfleri karışıklığı önlemek için hariçtir) |
| `kayitNo` | Kurum içi resmi SDP formatındaki sayı |
| `kurumId` / `birimId` / `evrakTuru` / `sdpKodu` | Yönlendirme ve sınıflandırma kararı |
| `basvuruSahibiAdSoyad` / `basvuruSahibiIletisim` | Başvuru sahibi bilgileri |
| `rawText` / `dosyaAdi` | Dilekçe metni ve orijinal dosya adı |
| `confidence` | Router ajanının sınıflandırma güven skoru |
| `eksikBilgiler` | JSON formatında tespit edilen eksik alan listesi |
| `analizOzeti` / `onceligi` / `mevzuatEslesmeleri` | Reader ajanının ürettiği özet, aciliyet (`normal` / `acil` / `gunlu`) ve mevzuat atıfları |
| `ekAnalizi` | Ek Belge Analiz Ajanı bulguları |
| `taslakYapisi` | JSON formatında resmi yanıt taslağı (`YanitTaslagi`: `{konu, hitap, govdeMetni}`) |
| `durum` | Evrak durum makinesi aşaması |

### `evrakSayaclari` — SDP Sıra Sayacı
`kurumId` (Primary Key) · `sonSayac`. Atomik `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` mekanizması ile yarış durumları (race condition) olmadan sıradaki resmi sayıyı üretir.

### `evrakEkleri` — Başvuru Ekleri
`ad` · `dosyaAdi` · `mimeTur` · `boyut` · `diskYolu` · `rawText` · `tur` (`gorsel` / `belge` / `pdf`) ve yapay zekâ analiz sonuçları (`analizOzeti`, `uygunlukDurumu`, `uygunlukNotu`). Dosyalar `./data/evrak-ekleri/<ekId>/` altında saklanır.

---

## Kurum İçi Belgeler ve Onay Süreci

### `belgeler` — Personel Belgeleri
`belgeTuru` (`dilekce` / `tutanak` / `sozlesme` / `karar`) · `baslik` · `baglam` · **`govdeMetni`** · `kaynaklar` (atıf yapılan mevzuat/bilgi bağlantıları) · `durum` · `olusturanKullaniciId` · `kurumId` · `birimId` · `sohbetId`.

### `belgeOnerileri` — Değişiklik Önerileri (Track-Changes)
`hedefTuru` / `hedefId` · **`oncekiMetin`** · `oneriMetin` · `gerekce` · `kaynak` (`ai` / `kullanici`) · `durum` (`bekliyor` / `kabul` / `red`).
Yapay zekâ değişiklikleri doğrudan metne uygulamaz; öneri olarak kaydeder. Kullanıcı kabul edene kadar belge orijinal halini korur.

### `onayAdimlari` — Onay Adımları
`hedefTuru` / `hedefId` · `sira` · `gerekliHiyerarsiSeviyesi` · `durum` (`bekliyor` / `onaylandi` / `reddedildi` / `duzeltme_istendi`) · `onaylayanKullaniciId` · `yorum` · `zaman`.

### `havaleler` — Yönlendirme Geçmişi
`hedefTuru` / `hedefId` · Eski ve yeni kurum/birim · `sebep` · `yapanKullaniciId` · `zaman`.

### `auditLog` — Denetim İzi
`evrakId` · `islem` · `kullanici` · `detay` (JSON) · `zaman`. Kayıt, sınıflandırma, onay, düzenleme ve bildirim adımlarının tamamını loglar.

---

## Durum Makineleri (State Machines)

### 1. Evrak Durum Döngüsü

```
             (Vatandaş Başvurusu)
                      │
                      ▼
               ic_incelemede ◄──── havaleEt (Kurum/birim değişirse
                      │             buraya döner)
         hitlOnayla   │
         (HITL #1)    ▼
             taslak_hazirlaniyor ──► Writer ajanı taslağı üretir,
                      │              onay adımları oluşturulur
                      ▼
               onay_zincirinde ◄──── taslakGuncelle (Doğrudan düzenleme
                      │               yapılırsa zincir başa döner)
   Her onay adımı     │
   sırayla ───────────┼── reddedildi / duzeltme_istendi ──► taslak_hazirlaniyor
                      │
               Son onay verildi
                      ▼
                 gonderildi        (Nihai Durum — Resmi yazı vatandaşa açılır)
```

### 2. Belge Durum Döngüsü

```
   taslak ──► tamamlandi ──► onay_zincirinde ──► onaylandi (Nihai Durum)
     ▲          (belgeGuncelle           │
     │           _tamamla=1 ile)         │
     └───────────────────────────────────┘
        Adımlardan biri reddeder veya düzeltme isterse → taslak durumuna döner
```
