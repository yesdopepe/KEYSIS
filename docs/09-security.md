# 09 — Güvenlik ve Kurum İzolasyonu

## Kimlik Doğrulama (Authentication)

Personel oturumları, `ebys_session` adında güvenli bir `httpOnly` çerezinde JWT (HS256, `jose`) olarak tutulur. Oturum süresi 8 saattir. Parolalar `bcrypt` ile tuzlanarak hashlenir.

Oturum verisi (`Session`) hafif ve bağımsızdır:
```ts
{
  userId, kullaniciAdi, adSoyad, kurumId, birimId,
  hiyerarsiSeviyesi, unvan, sistemYoneticisiMi,
  mevzuatYonetimi, bilgiTabaniYonetimi
}
```

Vatandaş tarafında **oturum tutulmaz**. `/basvuru` ve `/basvuru/durum` halka açıktır. Yalnızca vatandaşın kendi tarayıcısında taslak sohbetlerini görebilmesi için 30 günlük hafif bir çerez (`ebys_vatandas_sohbetler`) kullanılır.

---

## Yetkilendirme (Authorization)

`src/lib/auth/require-session.ts` altında üç seviyeli yetki denetimi bulunur:
1. `oturumZorunluKil()`: Giriş yapmamış kullanıcıları `/giris` sayfasına yönlendirir.
2. `oturumYoneticiZorunluKil()`: Yalnızca sistem yöneticilerine izin verir.
3. `oturumIzinliKil(izin)`: Belirli modül izinlerini denetler (Sistem Yöneticisi, Seviye 3 amirler veya ilgili rol iznine sahip olanlar).

### Hiyerarşi Seviyeleri
* **0 (Vatandaş):** Anonim kullanıcı, yalnızca resmi dilekçe taslağı oluşturabilir.
* **1 (Memur):** Kendi biriminin evraklarını inceler, tutanak hazırlayabilir.
* **2 (Şube Müdürü):** Birim onay zincirinin ilk adımını yürütür, sözleşme hazırlayabilir.
* **3 (Daire Başkanı / Kurum Amiri):** Nihai onay makamı, karar hazırlayabilir, kurum külliyatını yönetebilir.

---

## Kurum ve Kiracı İzolasyonu (Tenant Isolation)

Veri izolasyonu kuralları:
* **Evraklar:** Yalnızca kullanıcının kendi `birimId` değerine ait evraklar okunabilir ve işlem görebilir.
* **Belgeler:** `belgeyiOkuyabilirMi()` fonksiyonu ile hem sayfa seviyesinde hem de Server Action seviyesinde sıkı yetki kontrolü yapılır.
* **Sohbetler:** Her sohbet sorgusu `(id, kullaniciId, kurumId)` üçlüsü ile filtrelenir; başka bir personelin sohbetine ulaşılamaz.
* **Bilgi Tabanı & Vektörler:** Qdrant sorgularına `must: { kurumId }` filtresi sunucu tarafından zorunlu eklenir.

---

## Model Çıktı Güvenliği ve Halüsinasyon Önleme

### Prompt Enjeksiyonu Koruması
Ajanlara kullanıcı metnindeki talimatları "komut" olarak değil, "veri" olarak ele alma kuralı verilmiştir. Sistemin asıl koruması mimaridir: Hiçbir yapay zekâ aracının tek başına evrak onaylama, gönderme veya veri silme yetkisi yoktur.

### İki Akış Güvenlik Filtresi (Transform Streams)
1. **`harmonyKacagiKoruyucusu`:** Modelin iç düşünce ve muhakeme artıklarını (reasoning artifact) ve uydurma araç anlatımlarını arayüze sızmadan temizler.
2. **`dayanaksizAtifKoruyucusu`:** Modelin o turda çağırmadığı bir `/panel/...` iç bağlantısını arayüze yazmaya çalıştığı anda akışı güvenlik amacıyla otomatik olarak keser.

### Güvenli Hata Yönetimi
Altyapı veya veritabanı hata detayları istemciye asla çıplak (raw) olarak gönderilmez; kullanıcı dostu kurumsal Türkçe mesajlara dönüştürülür.
