# 08 — Ön Yüz (Frontend)

Next.js 16 App Router mimarisi kullanılır. Sayfalar varsayılan olarak Server Component'tir; yalnızca etkileşimin zorunlu olduğu noktalarda (sohbet, tuval, editör, modallar, tema seçici) Client Component kullanılır.

---

## Sayfa Envanteri

### Vatandaş Arayüzü (Halka Açık)
| Rota | Açıklama |
| --- | --- |
| `/` | Ana karşılama sayfası (üç yönlendirme kartı ve kurumsal rozet) |
| `/basvuru` | Başvuru formu: Metin, başvuru sahibi bilgileri, ekler, eksik bilgi soruları |
| `/basvuru/asistan` | Vatandaş dilekçe ve kurum danışmanı sohbeti (taslağı tuvalde açar) |
| `/basvuru/asistan/[sohbetId]` | Kaydedilmiş vatandaş sohbeti (`?belge=<id>` tuvali açar) |
| `/basvuru/durum` | Takip numarası ile durum sorgulama; tamamlandığında resmi yanıtı indirme |
| `/giris` | Kurum personeli giriş ekranı |

### Personel Arayüzü (Yetkilendirilmiş)
| Rota | Açıklama |
| --- | --- |
| `/panel` | Ana gösterge paneli: Özet istatistikler, incelenecek evraklar, kendi onayını bekleyen işler, gönderilenler |
| `/panel/evrak/[id]` | Evrak detay dosyası: Sınıflandırma, mevzuat atıfları, ek analizi, HITL #1 kontrolleri, taslak editörü, onay zinciri ve denetim izi (audit trail) |
| `/panel/asistan` | Personel asistanı ve geçmiş sohbetler listesi |
| `/panel/asistan/[sohbetId]` | Sohbet ve yanındaki dinamik belge çalışma tuvali |
| `/panel/belge` | "Belgelerim" listesi |
| `/panel/belge/[id]` | Bağımsız tam sayfa belge çalışma alanı |
| `/panel/mevzuat` | Mevzuat yönetimi ve madde detayları |
| `/panel/kurum-belgeleri` | Kurum bilgi tabanı ve parçalanmış vektör belgeleri |

### Sistem Yönetimi
`/yonetim` · `/yonetim/kurumlar` · `/yonetim/birimler` · `/yonetim/roller`. `YonetimShell` arkasında süper yönetici paneli.

---

## Sohbet ve Tuval Düzeni (Chat + Canvas)

Sohbet ve belge düzeni üç ana bileşenin işbirliği ile çalışır:
* **`SohbetDuzeni`:** Sohbet ekranını dikeyde tarayıcı penceresine göre boyutlandırır.
* **`SohbetCanvasDuzeni`:** Masaüstünde yan yana iki bölmeli (resizable) düzen sunar; mobil cihazlarda belgeyi alt açılır sayfada (Sheet) açar.
* **`BelgeTuvali` / `BelgeCalismaAlani`:** Belgenin görsel önizlemesi, editörü, öneri onaylama araçları ve dışa aktarım menüsünü barındırır.

---

## Resmi Belge Çıktı Motoru (Renderers)

Tek bir `ResmiBelge` modelinden dört farklı çıktı üretilir:
1. **Ekran Önizlemesi:** `ResmiBelgeOnizleme` / `DilekceOnizleme` (React)
2. **PDF Üretimi:** `@react-pdf/renderer` (Gömülü Tinos serif fontu ile)
3. **Word (DOCX):** `docx` kütüphanesi
4. **UYAP (UDF):** `fflate` ile üretilen sıkıştırılmış XML (`content.xml`)

---

## Tasarım Sistemi ve Temalar

* **Renk Paleti:** Kurumsal derin mavi (`--color-primary: #1e40af`), aksiyon yeşili (`--color-brand: #16a34a`), nötr arka plan ve kart tonları.
* **Tipografi:** Başlıklarda `Lexend`, gövdede `Source Sans 3`, resmi belgelerde `Tinos`.
* **Tema:** Aydınlık (açık), karanlık (koyu) ve sistem modu desteği. Sayfa yüklenirken parlama olmaması için erken yüklenen tema scripti (`TEMA_ON_YUKLEME_SCRIPTI`) bulunur.
