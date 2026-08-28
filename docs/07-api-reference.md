# 07 — API ve Server Actions Referansı

Sistemdeki veri mutasyonlarının büyük çoğunluğu Server Actions ile yürütülür. HTTP rotaları sadece akış (streaming), dosya indirme ve yetkili dosya sunumu için mevcuttur.

---

## HTTP Rotaları (API Routes)

### `POST /api/asistan`
Ana sohbet uç noktası (hem personel hem vatandaş ortak kullanır).
* **Gövde (Body):** `{ messages: UIMessage[], id?: string }`
* **Persona Seçimi:** Oturum yoksa veya referer `/basvuru/asistan` ise anonim vatandaş personası; aksi halde `prompts/asistan-agent.md` personel personası devreye girer.
* **Görsel Algılama:** Mesaj akışında `image/*` medya türü varsa model otomatik olarak `asistan_gorsel_agent`'a geçer.
* **Yanıt:** `UIMessageStream` — jeton akışı, araç çağrıları, araç sonuçları ve canlı tuvali besleyen `data-belge-taslak` parçaları içerir.
* **Korumalar:** `stopWhen: stepCountIs(8)`, iç muhakeme filtresi ve dayanaksız atıf koruyucu akışları devrededir.

### `POST /api/basvuru/asistan`
Vatandaş rehberlik danışmanı. Salt-okunur ve hafif bir uç noktadır (`stepCountIs(5)`).

### `POST /api/sohbet/ek`
Sohbete çok parçalı (multipart) dosya yükleme. Yüklenen belge ayrıştırılır, parçalanır ve yalnızca o sohbetin Qdrant vektör uzayına indekslenir.

### `GET /api/sohbet/[sohbetId]/ek/[ekId]`
Sohbete yüklenmiş dosyayı sunar. `(ekId, sohbetId, kurumId, kullaniciId)` dörtlüsü ile yetki denetimi yapılır.

### `GET /api/evrak/[id]/ek/[ekId]`
Evrak ekini sunar. Yalnızca yetkili oturumlara `200` döner.

### Dışa Aktarım Rotaları (Export Routes)
* `GET /api/evrak/[id]/disa-aktar?format=pdf|docx|udf` — Personel evrak cevabı dışa aktarımı.
* `GET /api/belge/[id]/disa-aktar?format=pdf|docx|udf` — Personel belgesi dışa aktarımı.
* `GET /api/basvuru/[takipNo]/disa-aktar?format=pdf|docx|udf` — **Vatandaş halka açık indirme rotası**. Evrak `gonderildi` durumunda değilse `403 Forbidden` döner.

---

## Server Actions Referansı

### Kimlik Doğrulama — `src/app/giris/actions.ts`
* `girisYap(prevState, formData)`: Parola doğrulaması (bcrypt), `aktifMi` kontrolü, rol izinlerinin oturuma aktarılması, JWT çerezinin oluşturulması ve yönlendirme.
* `cikisYap()`: Oturum çerezini temizler ve giriş sayfasına yönlendirir.

### Vatandaş Başvurusu — `src/app/basvuru/actions.ts`
* `aiDilekceOlusturAction(ozetKonu)`: Form üzerindeki tek tıkla dilekçe taslağı oluşturucu.
* `basvuruGonder(input)`: Ekleri kaydeder, metin çıkarımı yapar, yer tutucuları doldurur ve `basvuruIsle()` boru hattını çalıştırır (`eksik_bilgi` veya `tamamlandi` döner).
* `basvuruDurumSorgula(takipNo)`: Takip numarası ile başvuru sorgulama.

### Evrak Yönetimi — `src/app/panel/actions.ts`
* `hitlOnayla(evrakId)`: Sınıflandırmayı onaylar, Writer ajanını tetikler ve onay zincirini başlatır (`durum = "onay_zincirinde"`).
* `havaleEt(evrakId, formData)`: Evrağı başka birim/kuruma devreder.
* `taslakGuncelle(evrakId, formData)`: Taslak metnini doğrudan günceller (onay zincirini sıfırlar).
* `onayAdimiKarar(evrakId, adimId, karar, formData)`: Sıralı onay adımı kararı (onay/ret/düzeltme).
* `yaziOnerisiIste(evrakId, formData)`: Yapay zekâdan metin revizyon önerisi talep eder.
* `yaziOneriKarar(evrakId, karar, formData)`: Öneriyi kabul veya reddeder.

### Belge Yönetimi — `src/app/panel/belge/actions.ts`
* `belgeGuncelle` / `belgeMetniKaydet`: Belge gövdesini kaydeder.
* `belgeyiOnayaGonder(belgeId)`: Belge için onay adımlarını başlatır.
* `belgeOnayAdimiKarar(...)`: Belge onay kararını uygular.
* `belgeyiEvrakaYanitYap(belgeId, evrakId)`: Belge metnini ilgili evrakın cevabına kopyalar.
* `belgeRevizyonuOner(params)` / `belgeOneriKarar(...)`: Öneri üretim ve onaylama mekanizması.

### Yönetim ve Külliyat — `src/app/panel/.../actions.ts`
* `mevzuatYukle`, `mevzuatMaddesiEkleAction`, `mevzuatMaddesiKaldir`: Mevzuat yönetimi.
* `kurumBelgesiYukle`, `kurumBelgesiKaldir`: Kurum bilgi tabanı belge yönetimi.
* `kurumEkle`, `birimEkle`, `rolEkle`, `kullaniciEkle`: Sistem yönetimi (`/yonetim`).
