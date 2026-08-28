# 06 — Bilgi Erişimi ve RAG (Retrieval-Augmented Generation)

## Üç Ayrı Vektör Koleksiyonu

`src/lib/vektor/qdrant.ts` içerisinde tanımlanmış, tümü kosinüs benzerliği kullanan 1024 boyutlu üç bağımsız Qdrant koleksiyonu bulunur:

| Koleksiyon Adı | İçerik | Kapsam Filtresi | Birim Yapısı |
| --- | --- | --- | --- |
| `kurum_belge_parcalari` | Kurum içi bilgi tabanı (yönergeler vb.) | `kurumId` (`must`) | ~900 karakterlik parçalar |
| `mevzuat_maddeleri` | Mevzuat ve kanun külliyatı | `kurumId` veya `global` (`should`) | Madde bazlı |
| `sohbet_ekleri` | Sohbete yüklenen ek belgeler | `sohbetId` ve `kurumId` (`must`) | ~900 karakterlik parçalar |

Bu izolasyon mimari bir güvenlik garantisidir: Bir sohbete yüklenen geçici bir belge, hiçbir koşulda kurum geneli aramalarda veya başka bir kullanıcının sorgusunda görüntülenemez.

### `global` Ayrımı
Tüm kamu kurumlarını bağlayan genel kanun maddeleri (`kurum_id IS NULL`), Qdrant üzerinde `global` anahtarıyla etiketlenir ve her kurumun sorgusunda erişilebilir olur.

---

## Vektör Gömme (Embedding) Modeli

EVREN çıkarım servisi üzerindeki `bge-m3-embed` (1024 boyut) modeli kullanılır. Simetrik bir model olduğu için `query:` veya `passage:` ön eklerine gerek duyulmaz.

* **Uzun Metin Sınırı (`EMBED_METIN_SINIRI = 6000`):** Büyük taranmış belgelerde OCR bir madde başlığını atlarsa iki madde birleşebilir. Model bağlam taşmasını önlemek için embedding girdisi 6000 karakterle sınırlandırılır; ancak PostgreSQL tam metni eksiksiz saklar.
* **Yığın Boyutu (`YIGIN_BOYUTU = 32`):** Gömme ve Qdrant yükleme işlemleri 32'şerli paketler halinde toplu (batch) olarak yürütülür.

---

## Metin Parçalama (Chunking) Stratejileri

1. **Kurum Bilgi Tabanı (`metniParcala`):** Paragraf sınırlarından bölünerek maksimum 900 karakterlik bloklar oluşturulur. Cümle bütünlüğünü korumak ve sınırda kalan bilgileri kaybetmemek için 150 karakterlik örtüşme (overlap) uygulanır.
2. **Mevzuat Metinleri (`mevzuatMetniParcala`):** Metinler `MADDE n` başlıklarından ayrıştırılır. Başlığın hemen üzerindeki kısa satır (ör. `Amaç\nMADDE 1 – ...`) maddenin başlığı olarak kaydedilir.

---

## Atıf Güvenliği ve Halüsinasyon Koruması

Ajanların ürettiği cevaplardaki mevzuat ve belge bağlantılarının (`link`) gerçekliğini garanti altına almak için üç aşamalı koruma uygulanır:
1. **Prompt Kuralı:** Ajanlara bağlantı adreslerini yalnızca araçtan dönen `link` alanından alma zorunluluğu verilir.
2. **Son Filtreleme (Post-Filter):** Belge taslağında yalnızca modelin önüne getirilen gerçek kaynak maddeler bağlantılandırılır.
3. **Akış Güvenlik Filtresi (`dayanaksizAtifKoruyucusu`):** Canlı sohbette yapay zekâ o turda çağrılmamış bir `/panel/...` iç bağlantısı uydurmaya çalıştığı anda akış güvenlik mekanizması tarafından derhal kesilir.

---

## Sözlüksel (Lexical) Benzerlik ve Türkçe Normalizasyon

`src/lib/search/metin-benzerligi.ts` modülü, dış bağımlılığı olmayan Türkçe duyarlı bir sözlüksel benzerlik hesaplayıcıdır. Router ajanının güven skorunu bağımsız olarak doğrulamak ve geri dönüş durumunda en uygun şablonu seçmek için kullanılır.

Modül ayrıca Türkçe büyük/küçük harf dönüşümlerini (`İ→i`, `I→ı`, `i→İ`, `ı→I`) hatasız yapan `trNormalize` ve `trUpper` yardımcı fonksiyonlarını içerir.
