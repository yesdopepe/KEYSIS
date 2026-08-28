# 04 — Yapay Zekâ Ajan Katmanı

## İki Temel Kodlama Kuralı

1. **Hiçbir ajan modülü doğrudan LLM SDK'sı import etmez.** Her model çağrısı `src/lib/ai/client.ts` içindeki `getAgentModel(agentName)` fonksiyonu üzerinden yürütülür ve `{ model, temperature, maxOutputTokens }` nesnesi döner.
2. **Kod içerisinde hiçbir prompt hardcode edilmez.** Sistem promptları `prompts/*.md` dosyalarında tutulur ve `src/lib/ai/prompt.ts` içerisindeki `loadPrompt(name, vars)` fonksiyonu ile değişkenleri doldurularak yüklenir.

Model seçimleri ortam değişkenleri üzerinden yönetilir; böylece kod değiştirilmeden model değişimi yapılabilir. Varsayılan konfigürasyonlar `src/lib/ai/config.ts` dosyasındadır.

---

## Ajan Kayıt Defteri (Registry)

| Ajan Anahtarı | Prompt Dosyası | Görevi / Kısa Özet |
| :--- | :--- | :--- |
| `router_agent` | `router-agent.md` | Gelen dilekçeyi analiz ederek yetkili kurum, birim ve evrak türüne sınıflandırır. |
| `reader_agent` | `reader-agent.md` | Evrak metnini anlamlandırır, özet ve aciliyet çıkarır, ilgili mevzuat maddeleriyle eşleştirir (RAG). |
| `writer_agent` | `writer-agent.md` | Kurum şablonuna ve resmi yazışma standartlarına uygun resmi cevap yazısı taslağı üretir. |
| `eksik_bilgi_agent` | `eksik-bilgi-agent.md` | Dilekçeyi zorunlu alan şemasıyla karşılaştırarak eksik bilgileri ve vatandaşa yöneltilecek soruları belirler. |
| `belge_yazar_agent` | `belge-yazar-agent.md`, `belge-onerisi-agent.md` | Personel belgelerini (tutanak, sözleşme, karar) tuvalde oluşturur ve metin revizyon önerileri üretir. |
| `asistan_agent` | `asistan-agent.md` | Kurum personeline mevzuat, iç yönergeler ve belge üretiminde 10 farklı araçla akıllı rehberlik sağlar. |
| `asistan_gorsel_agent` | `asistan-agent.md` | Görsel veya taranmış belge içeren personel sohbetlerinde çok modlu (multimodal) analiz ve destek sunar. |
| `sohbet_baslik_agent` | Kod içi (inline) | Kullanıcının ilk mesajına göre 3-5 kelimelik kurumsal sohbet başlığı üretir. |
| `ek_analiz_agent` | `ek-analiz-agent.md` | Yüklenen ek belgeleri (tapu, tutanak, fatura vb.) dilekçe metniyle çapraz doğrulayarak tutarlılık analizi yapar. |
| `vatandas_asistan_agent` | `vatandas-asistan-agent.md` | Vatandaşlara yetkili idari merciyi bulma ve 3071 sayılı Kanuna uygun resmi dilekçe hazırlama danışmanlığı verir. |

---

## Yapılandırılmış Çıktı Üreten Ajanlar (Structured-Output)

Bu altı ajan `src/lib/agents/` altında yer alır ve katı Zod şemalarıyla `generateObject` / `streamObject` kullanır:

### 1. Router (Sınıflandırıcı) — `router.ts`
Dilekçeyi `(kurum, birim, evrakTuru)` üçlüsüne sınıflandırır. Model, veritabanındaki gerçek `yazismaSablonlari` satırları arasından (`z.enum`) seçim yapar; bu sayede var olmayan bir kurumu/birimi uydurması (halüsinasyon) yapısal olarak imkânsızdır.
* **Güven Skoru Üst Sınırı (Ceiling):** Modelin kendi bildirdiği güven skoru, sözlüksel (lexical) benzerlik sıralamasıyla doğrulanır. Sözlüksel sırada 1. ise tavan 0.95, ilk 3'te ise 0.75, aksi halde 0.50'dir.
* **Geri Dönüş (Fallback):** Sözlüksel en iyi eşleşme, tavan 0.60 güven skoru ile atanır.

### 2. Reader (Okuyucu & Anlamlandırıcı) — `reader.ts`
Evrak metnini analiz eder ve mevzuat RAG araması yapar. Qdrant'tan gelen en iyi 6 mevzuat maddesini değerlendirerek hangilerinin gerçekten hukuki dayanak teşkil ettiğini belirler.
* **Eşik Değeri:** `MEVZUAT_GUVEN_ESIGI = 0.45` altındaki zayıf eşleşmeler elenir.
* **Geri Dönüş (Fallback):** `ozet: null`, mevzuat listesi boş bırakılır ve loglanır. Uydurma içerik üretilmez.

### 3. Eksik Bilgi Ajanı — `eksik-bilgi.ts`
Dilekçe metnini eşleşen şablonun `zorunlu` alanlarıyla karşılaştırır. Eksik bilgi tespit ederse vatandaşa sorulacak net ve anlaşılır sorular üretir. Altyapı hatasında vatandaşı engellememek için eksik alan olmadığını varsayar (fail-safe).

### 4. Writer (Resmi Yazı Yazarı) — `writer.ts`
Evrakın şablonundaki `taslakKurallari` direktiflerine uygun olarak resmi cevap yazısı taslağını (`{konu, hitap, govdeMetni}`) oluşturur. Gövde metni tek parça, akıcı ve resmi yazışma usullerine uygun bir bütün olarak üretilir.

### 5. Belge Yazarı — `belge-yazar.ts`
* `belgeTaslagiOlusturAkisli()`: Personel belgelerini (tutanak, sözleşme, karar) `streamObject` ile anlık olarak tuvalde oluşturur.
* `belgeOnerisiOlustur()`: Kullanıcı talimatına göre metin üzerinde değişiklik önerisi (track-changes) üretir.

### 6. Ek Belge Analiz Ajanı — `ek-analiz.ts`
Vatandaşın yüklediği ek belgeleri (tapu, fatura, tutanak, fotoğraf vb.) dilekçe metniyle çapraz kontrole tabi tutar ve tutarlılık raporu (`uyumlu`, `incelenmeli`, `eksik`, `supheli`) sunar.

---

## Sohbet Ajanları ve Araçlar

### Personel Asistanı — `POST /api/asistan`
10 adet zengin araca sahip akışlı sohbet motoru:
* `kurumBelgelerindeAra`: Kurumun kendi mevzuat ve yönerge bilgi tabanında arar.
* `mevzuatAra`: Genel kanun ve yönetmelik külliyatında arar.
* `sohbetEkindeAra`: Yalnızca o sohbete yüklenmiş ek belgelerde arar.
* `belgeTaslagiHazirla`: Tuvalde yeni bir resmi belge taslağı açar.
* `evrakYenidenAnalizEt`: Evrakı yeniden sınıflandırır (`ic_incelemede` durumundayken).
* `evrakTaslakOnerisiOlustur` / `belgeRevizyonuOner`: Metin üzerine değişiklik önerisi sunar (doğrudan uygulamaz).
* `belgeyiOnayaGonder`: Onay sürecini başlatır (onaylama yetkisi sadece insandadır).
* `belgeyiSiniflandir` / `evrakYanitAdayiBul`: Yönlendirme ve eşleştirme tavsiyeleri verir.

### Vatandaş Rehberlik Asistanı — `POST /api/basvuru/asistan`
Vatandaşa hangi kurumun yetkili olduğunu (`kurumVeBirimleriListele`) ve hukuki dayanakları (`mevzuatBilgisiSorgula`) açıklayan salt-okunur güvenli danışman.
