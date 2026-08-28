# KEYSİS — Proje Dokümantasyonu

KEYSİS (Kapsamlı Evrak Yönetim Sistemi) — TEKNOFEST için geliştirilmiş Elektronik Belge Yönetim Sistemi (EBYS) ve üzerine kurulu Yapay Zekâ Ajan Katmanı teknik dokümantasyonu.

## İçindekiler

| Doküman | Kapsam |
| --- | --- |
| [01 — Genel Bakış](01-overview.md) | Sistemin amacı, iki ana kullanıcı yolculuğu, teknoloji yığını, dizin yapısı |
| [02 — Mimari](02-architecture.md) | Çalışma zamanı topolojisi, dört servis, istek akışları, güvenlik sınırları |
| [03 — Veri Modeli](03-data-model.md) | Tüm tablolar, sütun anlambilimi, ilişkiler, iki durum makinesi |
| [04 — Ajan Katmanı](04-agents.md) | On yapay zekâ ajanı, model yönlendirme, promptlar, yapılandırılmış çıktılar, geri dönüş (fallback) mekanizmaları |
| [05 — İş Akışları](05-workflows.md) | Vatandaş başvuru hattı, HITL denetim noktaları, onay zincirleri, belge yazım süreçleri |
| [06 — Bilgi Erişimi ve RAG](06-retrieval.md) | Üç vektör koleksiyonu, parçalama, gömme (embedding), mevzuat dayanağı |
| [07 — API ve Eylemler](07-api-reference.md) | HTTP rotaları, Server Actions, sohbet araçları, dışa aktarım uç noktaları |
| [08 — Ön Yüz (Frontend)](08-frontend.md) | Sayfa envanteri, kabuklar (shells), sohbet + tuval düzeni, tasarım belirteçleri |
| [09 — Güvenlik ve Çoklu Kurum](09-security.md) | Oturumlar, RBAC, kurum izolasyonu, prompt enjeksiyonu ve halüsinasyon korumaları |
| [10 — Operasyon ve Dağıtım](10-operations.md) | Ortam değişkenleri, kurulum, betikler, dağıtım yönergeleri, demo hesapları |

## Terimler Sözlüğü (Glosar)

| Terim | Sistemdeki Karşılığı ve Anlamı |
| --- | --- |
| **kurum** | Kamu Kurumu (belediye, kaymakamlık, valilik, bakanlık) — sistemdeki ana kiracı (tenant) sınırı |
| **birim** | Kurum içerisindeki müdürlük veya idari birim; kendi içinde ağaç yapısına sahiptir ve onay zincirini belirler |
| **evrak** | Vatandaş tarafından sunulan, yaşam döngüsü boyunca takip edilen kayıtlı başvuru |
| **dilekçe** | Vatandaşın resmi talep ve şikayetini içeren ana başvuru metni |
| **belge** | Kurum personeli tarafından üretilen iç yazışma (tutanak / sözleşme / karar) veya sohbette hazırlanan dilekçe taslağı |
| **takip no** | Vatandaşın giriş yapmadan başvurusunu sorgulamasını sağlayan 8 karakterli takip kodu |
| **kayıt no** | Kurum içi Standart Dosya Planı (SDP) formatındaki resmi sayı (`haberleşme_kodu-sdp_kodu/sıra`) |
| **SDP** | Standart Dosya Planı — Türk kamu idaresi dosya sınıflandırma standardı |
| **mevzuat / madde** | Mevzuat külliyatı ve atıf yapılabilen bağımsız kanun/yönetmelik maddeleri (ör. `5393/15`) |
| **yazışma şablonu** | Kurum ve evrak türüne özel şablon: zorunlu alan şeması ve yazım üslubu kuralları |
| **onay zinciri** | Belirli hiyerarşik sıralamaya sahip çok adımlı onay mekanizması |
| **havale** | Evrak veya belgenin yetkili başka bir birime/kuruma devredilmesi |
| **hiyerarşi seviyesi** | Personel kademesi (1 = memur, 2 = şube müdürü, 3 = daire başkanı / kurum amiri; 0 = vatandaş) |
| **öneri** | Yapay zekâ tarafından sunulan ve yetkili personel onayı bekleyen değişiklik önerisi (track-changes) |
| **tuval (canvas)** | Sohbetin yanında belgenin anlık olarak görüntülendiği ve düzenlendiği çalışma alanı |
| **sohbet / ek** | Yapay zekâ asistanı görüşmeleri ve görüşmeye yüklenen belgeler/kanıtlar |
| **HITL** | Human-in-the-Loop — Zorunlu insan denetimi ve onay noktası |
