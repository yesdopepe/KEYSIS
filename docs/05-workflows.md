# 05 — İş Akışları (Workflows)

## A. Vatandaş Başvuru Süreci

Başvuru kanalları: Doğrudan `/basvuru` formu veya `/basvuru/asistan` üzerindeki akıllı danışman (dilekçeyi tuvalde oluşturup forma aktarır).

### Yer Tutucu ve Eksiklik Kontrolü (Placeholder Gate)
Yapay zekânın bilmediği dinamik alanlar `[EK BİLGİ GEREKLİ: Tarih]`, `[EK BİLGİ GEREKLİ: Ada/Parsel]` şeklinde işaretlenir.
* `src/lib/basvuru/eksiklik.ts`: Hem tarayıcıda formu denetler hem de sunucuda başvuruyu işleme almadan önce doğrular.
* `yerTutuculariDoldur()`: Kullanıcının girdiği cevapları dilekçe metnindeki ilgili köşeli parantez alanlarının **içine doğrudan yerleştirir**.

### Başvuru Hattı (Pipeline)
`src/lib/cases/pipeline.ts` → `basvuruIsle()`:
1. `eksikYerTutucular()`: Doldurulmamış etiket varsa `{ durum: "eksik_bilgi" }` döner (model harcaması yapılmaz).
2. Karakter kontrolü: Boşluk ve etiketler hariç en az 40 karakter aranır (3071 sayılı Dilekçe Kanunu hakkı korunur).
3. `siniflandirDilekce()`: Router Ajanı şablon, kurum, birim ve güven skorunu belirler.
4. `sablonGetir()`: Kurumun ilgili yazışma şablonunu çeker.
5. `eksikBilgiTespitEt()`: Zorunlu alan kontrolü yapılır; eksik varsa aynı oturumda vatandaşa ek sorular yöneltilir.
6. `evrakiOku()`: Reader Ajanı özet, aciliyet ve mevzuat dayanaklarını çıkarır.
7. `ekleriAnalizEt()`: Ek belgelerin tutarlılık analizini yapar.
8. `yeniKayitNo()`: Kurum sayacından atomik resmi SDP kayıt sayısı üretir (`<haberlesmeKodu>-<sdpKodu>/<sıra>`).
9. `yeniTakipNo()`: Vatandaş için 8 karakterli takip numarası üretir.
10. `INSERT`: `evraklar` (`durum = "ic_incelemede"`), `evrakEkleri` ve `auditLog` kayıtları oluşturulur.

---

## B. HITL #1 — Memur İnceleme ve Anlamlandırma Onayı

Sayfa: `/panel/evrak/[id]`. Yetki: Kullanıcının kendi birimine ait evraklar.
Memur arayüzde yapay zekânın sınıflandırmasını, güven skorunu, özetini, atıf yapılan mevzuat maddelerini ve ek belge analizlerini inceler. İki seçenek bulunur:
* **`hitlOnayla(evrakId)`**: Sınıflandırmayı onaylar → `durum = "taslak_hazirlaniyor"` → Writer Ajanı şablon kurallarına göre resmi yazı taslağını (`taslakYapisi`) üretir → `durum = "onay_zincirinde"` olur ve birimin hiyerarşik onay adımları oluşturulur.
* **`havaleEt(evrakId, formData)`**: Evrağı başka bir kuruma/birime devreder; evrak `ic_incelemede` durumunda kalarak yeni birimin HITL #1 ekranına düşer.

---

## C. Taslak Düzenleme ve Değişiklik Önerileri

Resmi cevap metni üç farklı şekilde güncellenebilir:
1. `taslakGuncelle`: Memurun metni doğrudan elle düzenlemesi.
2. `yaziOnerisiIste`: Yapay zekâdan revizyon istenmesi → `belgeOnerileri` tablosuna `bekliyor` olarak yazılır.
3. `yaziOneriKarar`: Personelin yapay zekâ önerisini kabul veya reddetmesi.

**Değişmezlik Kuralı:** Bir amir onay verdikten sonra metin habersiz değiştirilemez. Metin güncellendiğinde `onayZinciriSifirla()` çağrılarak onay adımları sıfırlanır ve zincir baştan başlar.

---

## D. HITL #2 — Sıralı Onay Zinciri

Motor: `src/lib/onay/index.ts` → `adimKararVer()`:
1. İlgili onay adımı mevcut ve `bekliyor` durumunda olmalıdır.
2. **Önceki tüm adımlar (`sira <`) onaylanmış olmalıdır** (sıralı onay kuralı).
3. Kullanıcının `hiyerarsiSeviyesi`, adımın `gerekliHiyerarsiSeviyesi` ile **birebir eşit** olmalıdır (Daire başkanı, şube müdürünün adımını atlayamaz).

* `reddedildi` veya `duzeltme_istendi`: Evrak `taslak_hazirlaniyor` aşamasına döner.
* Son adımın `onaylandi` olması: Evrak `gonderildi` durumuna geçer ve resmi yazı vatandaşa açılır.

---

## E. Personel Belge Üretimi (Tutanak, Sözleşme, Karar)

Belgeler yalnızca kurum asistanının `belgeTaslagiHazirla` aracı ile oluşturulur:
* `dilekce`: Vatandaş (0) ve tüm seviyeler
* `tutanak`: Memur (Seviye 1+)
* `sozlesme`: Şube Müdürü (Seviye 2+)
* `karar`: Daire Başkanı / Kurum Amiri (Seviye 3)

Belge oluşturulduğunda yan paneldeki tuvalde (`BelgeCalismaAlani`) anlık olarak açılır (`streamObject`). Tuval üzerinden düzenleme, öneri inceleme, onay başlatma ve dışa aktarım yapılabilir. `belgeyiEvrakaYanitYap` fonksiyonu ile hazırlanan belge doğrudan bir vatandaş başvurusunun cevabına dönüştürülebilir.

---

## F. Vatandaş Sorgulama ve Teslimat

Vatandaş `/basvuru/durum` sayfasından sadece 8 haneli `takipNo` ile giriş yapmadan sorgulama yapar.
* Cevap yazısı yalnızca evrak **`durum === "gonderildi"`** olduğunda görüntülenir ve indirilebilir.
* Resmi formatta PDF, Word (DOCX) ve UYAP (UDF) formatlarında indirilebilir.

---

## G. Bilgi Tabanı ve Mevzuat Yönetimi

Yalnızca yetkili personel (Sistem Yöneticisi, Seviye 3 veya ilgili rol iznine sahip olanlar) yönetebilir:
* **Mevzuat (`/panel/mevzuat`):** Yüklenen kanun/yönetmelik metinleri `MADDE n` başlıklarına göre otomatik parçalanarak indekslenir.
* **Kurum Bilgi Tabanı (`/panel/kurum-belgeleri`):** İç yönergeler ve prosedürler Docling ile metne dönüştürülüp 900 karakterlik parçalar halinde Qdrant'a yüklenir.
