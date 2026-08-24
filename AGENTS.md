# EBYS + AI Ajan Katmanı — MVP Görev Yol Haritası

Bu dosya, Teknofest EBYS projesinin 2 haftalık MVP geliştirme yol haritasıdır.
Antigravity bu dosyayı her konuşmada okur ve mevcut duruma göre sıradaki
aşamadan devam eder. **Kapsam dışı maddeleri (Bölüm 2) asla önerme veya implemente etme.**

---

## Durum Takibi

Tamamlanan aşamaları `[x]` ile işaretle, aktif olanı `[/]` ile:

- [x] **Aşama 1** — İskelet ve state tanımı ✅ (20/20 test geçiyor)
- [x] **Aşama 2** — Ingestion (AnyDoc, senkron) ✅ (32/32 test geçiyor)
- [x] **Aşama 3** — EBYS çekirdek: evrak kayıt + SDP modülü ✅ (41/41 test geçiyor)
- [ ] **Aşama 4** — Router Agent
- [ ] **Aşama 5** — Qdrant + mcp_mevzuat + Reader Agent
- [ ] **Aşama 6** — HITL node #1 (anlamlandırma onayı)
- [ ] **Aşama 7** — Writer Agent + resmi yazışma skill'i
- [ ] **Aşama 8** — HITL node #2 + mcp_memory + onay zinciri
- [ ] **Aşama 9** — Süre takibi + audit log + RBAC
- [x] **Aşama 10** — Frontend (HITL review + evrak listesi) ✅ (Next.js 15, UI/UX Pro Max)
- [ ] **Aşama 11** — Multi-tenant config + metrikler

---

## Kapsam Dışı — YAPMA (kesin sınır)

- E-imza (kriptografik imza altyapısı)
- EYP (e-Yazışma Paketi) üretimi
- KEP / DETSİS entegrasyonu
- Arşiv & imha planı (saklama süreleri, tasfiye süreçleri)
- Gizlilik derecesi yönetimi
- Kurumlar arası (dış) gönderim
- Kapsamı genişletme, "iyi olur" diye ekstra modül önerme

Bu maddeler için sadece `TODO` yorum satırı bırakmak yeterli.

---

## Kodlama Kuralları (her aşamada uy)

1. Hiçbir LangGraph node'u doğrudan LLM SDK import etmesin — hepsi `app/llm/client.py` üzerinden
2. Model adı `config/model_config.yaml`'dan gelsin, hardcode yok
3. HITL noktaları asla bypass edilemesin
4. Agent prompt'ları kod içinde hardcode değil, ayrı `.md`/`.txt` dosyalarında
5. Her MCP server bağımsız çalıştırılabilir ve test edilebilir olmalı
6. Türkçe metin: UTF-8 zorunlu
7. AnyDoc yerel (offline) Rust kütüphanesidir (`anydoc` / `firecrawl-anydoc`), veri dışarıya çıkmaz
8. Her aşama sonunda `docker-compose up` ile çalışır sistem olmalı
9. Takılırsan basitleştir, kapsamı genişletme
10. Her aşama tamamlandığında frontend (Next.js) tarafı da güncellenmeli:
    - Yeni backend endpoint'leri varsa ilgili UI bileşeni/sayfası eklenmeli veya güncellenmeli
    - Yeni veri alanları frontend'de görüntülenmeli (tablo, kart, detay sayfası vb.)
    - HITL akışları backend'e bağlandığında frontend'teki HITL review ekranları da fonksiyonel hale getirilmeli
    - `npm run build` ile hatasız derlenmeli

---

## Aşama 2 — Ingestion (AnyDoc, yerel & senkron)

**Dosyalar:**
- `backend/app/ingestion/anydoc_client.py` — yerel AnyDoc kütüphanesi entegrasyonu

**Yapılacak:**
1. `anydoc_client.py` içinde Firecrawl AnyDoc (`anydoc` Python paketi / Rust engine) kütüphanesini yerel olarak çağır
2. `anydoc.to_markdown_bytes(data, format=...)` ile belgeleri (PDF, DOCX, XLSX, PPTX, CSV vb.) Markdown'a dönüştür
3. Otomatik format tespiti yap (`anydoc.format_from_bytes` ve `anydoc.format_from_extension`)
4. Response'u `{"raw_text": str, "metadata": dict, "source": str}` formatına dönüştür
5. Düz metin/UTF-8 için fallback çözümleme ekle
6. `routes.py` içindeki `/evrak/upload` endpoint'ine ayrıştırma adımını entegre et
7. Parse edilen metni state'in `raw_text` alanına yaz
8. Test yaz: AnyDoc ile yerel upload → raw_text Markdown formatında dolu mu?

**Doğrulama:**
```bash
pytest tests/ -v
curl -X POST http://localhost:8000/evrak/upload -F "file=@data/sample_evraklar/test_evrak.txt"
```

---

## Aşama 3 — EBYS Çekirdek: Evrak Kayıt + SDP Modülü

**Dosyalar:**
- `backend/app/ebys/evrak_kayit.py` — doldurmak
- `backend/app/ebys/sdp.py` — doldurmak
- `backend/app/models/` — SQLAlchemy modelleri eklemek

**Yapılacak:**
1. SQLAlchemy modelleri tanımla: `Evrak`, `SDPKodu`, `AuditLog` tabloları
2. Alembic migration oluştur ve `docker-compose` ile Postgres'e uygula
3. `sdp.py` — `sdp_belediye.json`'u Postgres'e yükleyen seed fonksiyonu yaz
4. `sdp.py` — Embedding tabanlı benzerlik araması ekle (basit — TF-IDF veya sentence transformer)
5. `evrak_kayit.py` — SDP formatlı sayı üretimi: `haberleşme_kodu-sdp_kodu/kayit_no`
   - `haberleşme_kodu`: `kurum_config.py`'den
   - `sdp_kodu`: henüz placeholder (Aşama 4'te Router kararı gelecek)
   - `kayit_no`: Postgres sequence
6. Evrak kaydını Postgres'e yaz
7. `routes.py`'ye `GET /evrak/{id}` ve `GET /evrak/` endpoint'lerini Postgres'ten okuyacak şekilde güncelle
8. In-memory store'u kaldır, Postgres'e geç
9. Test: evrak kaydet → DB'den oku → kayit_no formatını doğrula

**Doğrulama:**
```bash
docker-compose up --build
pytest tests/ -v
curl http://localhost:8000/evrak/
```

---

## Aşama 4 — Router Agent

**Dosyalar:**
- `backend/app/graph/nodes/router_agent.py` — doldurmak
- `backend/app/graph/orchestrator.py` — LangGraph graph tanımı başlat
- `backend/skills/evrak-siniflandirma/SKILL.md` — zaten var, referans olarak kullan

**Yapılacak:**
1. Embedding tabanlı hafif sınıflandırıcı kur:
   - SDP kodlarının konu açıklamalarını embed et
   - Evrak metninin embedding'i ile cosine similarity hesapla
   - En yüksek N eşleşmeyi döndür
2. LLM destekli karar: `app/llm/client.py` üzerinden `router_agent` config'i ile çağır
3. Çıktı: `SiniflandirmaBilgisi` (sdp_kodu, birim_kodu, confidence, aciklama)
4. Confidence eşiği: `< 0.7` ise `hitl_reader_durumu = "bekliyor"` olarak HITL'e düşür
5. `orchestrator.py`'de LangGraph `StateGraph` başlat:
   - `ingestion → router → ...` akışını tanımla
   - Şimdilik router'dan sonra end node
6. Router agent prompt'unu ayrı dosyada tut: `skills/evrak-siniflandirma/` veya `prompts/`
7. State'e sdp_kodu, birim, confidence yaz
8. Test: örnek metin → doğru SDP kodu + birim eşleşmesi

**Doğrulama:**
```bash
pytest tests/ -v
# Manuel test: imar konulu bir metin yükle → SDP kodu 100-199 aralığında mı?
```

---

## Aşama 5 — Qdrant + mcp_mevzuat + Reader Agent

**Dosyalar:**
- `backend/app/vectorstore/qdrant_client.py` — doldurmak
- `backend/mcp_servers/mcp_mevzuat/` — MCP server implemente et
- `backend/app/graph/nodes/reader_agent.py` — doldurmak
- `data/mevzuat_corpus/` — demo mevzuat metinleri ekle

**Yapılacak:**
1. `qdrant_client.py` — `mevzuat_maddeleri` ve `duzeltme_gecmisi` collection'larını oluştur
2. Demo mevzuat metinleri hazırla: 5393 Belediye Kanunu, 3194 İmar Kanunu vb. (en az 20-30 madde)
3. Mevzuat maddelerini Qdrant'a embed edip yükle
4. `mcp_mevzuat/` — `search_mevzuat(query, kurum)` tool'u olan MCP server
5. Reader agent: LiteLLM wrapper + mevzuat MCP tool ile:
   - Evrak analizi yap
   - İlgili mevzuat maddelerini bul (RAG)
   - Yapılandırılmış çıktı üret: `{konu, ilgili_mevzuat[], aciliyet, onerilen_aksiyon}`
6. Reader prompt'u ayrı dosyada
7. `orchestrator.py`'ye reader node'u ekle: `router → reader → ...`
8. Test: örnek evrak → mevzuat eşleşmeleri listesi dolu mu?

**Doğrulama:**
```bash
docker-compose up --build  # Qdrant ayağa kalksın
pytest tests/ -v
```

---

## Aşama 6 — HITL Node #1 (Anlamlandırma Onayı)

**Dosyalar:**
- `backend/app/graph/nodes/hitl_nodes.py` — `hitl_reader_node` doldurmak
- `backend/app/api/routes.py` — HITL review endpoint'leri ekle

**Yapılacak:**
1. LangGraph `interrupt()` kullanarak Reader çıktısını insana göster
2. HITL review API endpoint'i: `POST /evrak/{id}/hitl/reader` — onay/düzeltme/ret
3. İnsana gösterilecek bilgi: AI sınıflandırma kararı, mevzuat eşleşmeleri, önerilen aksiyon
4. Onay → devam, düzeltme → state güncelle → devam, ret → pipeline dur
5. HITL noktası asla bypass edilemesin — graph'ta zorunlu node
6. `orchestrator.py`'ye HITL node ekle: `reader → hitl_reader → ...`
7. Test: interrupt tetikleniyor mu? Onay sonrası devam ediyor mu?

---

## Aşama 7 — Writer Agent + Resmi Yazışma Skill'i

**Dosyalar:**
- `backend/app/graph/nodes/writer_agent.py` — doldurmak
- `backend/skills/resmi-yazisma-formati/SKILL.md` — zaten var, Writer bu skill'i okuyacak

**Yapılacak:**
1. Writer agent: LiteLLM wrapper ile taslak üret
2. `resmi-yazisma-formati/SKILL.md`'den format kurallarını prompt'a dahil et
3. Kolektif hafızadan (varsa) benzer düzeltmeleri few-shot olarak al
4. Taslak formatı: başlık (T.C., kurum adı, sayı, konu, tarih) + gövde + imza bloğu + ekler
5. SDP formatlı sayı numarasını başlığa yerleştir
6. State'e `taslak_metin` yaz
7. `orchestrator.py`'ye writer node ekle: `hitl_reader → writer → ...`
8. Test: örnek evrak → taslak metin resmi format kurallarına uyuyor mu?

---

## Aşama 8 — HITL Node #2 + mcp_memory + Onay Zinciri

**Dosyalar:**
- `backend/app/graph/nodes/hitl_nodes.py` — `hitl_writer_node` doldurmak
- `backend/mcp_servers/mcp_memory/` — MCP server implemente et
- `backend/app/memory/feedback_store.py` — doldurmak
- `backend/app/ebys/onay_zinciri.py` — pipeline'a entegre et

**Yapılacak:**
1. İkinci HITL interrupt: Writer taslağını insana göster
2. `POST /evrak/{id}/hitl/writer` — düzenleme/onay endpoint'i
3. `mcp_memory/` MCP server: `save_feedback`, `get_similar_feedback` tool'ları
4. Düzeltmeleri Qdrant'a yaz: `(orijinal_taslak, duzeltilmis_taslak, evrak_tipi, kurum_id)`
5. Writer yeni taslaklarda bu düzeltmeleri few-shot örnek olarak kullansın
6. Onay zinciri entegrasyonu: HITL onayı geldiğinde `taslak_hazirlandi → incelemede → onaylandi → gonderildi`
7. `orchestrator.py` tam pipeline: `ingestion → router → reader → hitl_reader → writer → hitl_writer → onay → end`
8. Test: tam pipeline akışı — evrak yükle → ... → taslak onaylandı → durum "gönderildi"

---

## Aşama 9 — Süre Takibi + Audit Log + RBAC

**Dosyalar:**
- `backend/app/ebys/sure_takibi.py` — pipeline'a entegre et
- `backend/app/ebys/audit_log.py` — Postgres'e taşı
- `backend/app/ebys/rbac.py` — middleware olarak entegre et

**Yapılacak:**
1. `sure_takibi.py` — evrak listesine uyarı rozeti ekle (3 gün sarı, 7 gün kırmızı)
2. `audit_log.py` — her işlemi Postgres `audit_log` tablosuna yaz (in-memory'den taşı)
3. Audit loglanacak işlemler: kayıt, sınıflandırma, HITL onayı, düzenleme, gönderim
4. `rbac.py` — FastAPI dependency olarak entegre et:
   - `memur`: kendi evraklarını görür
   - `sube_muduru`: birimindeki tüm evrakları görür
5. Login/auth: basit token bazlı (JWT veya API key — karmaşık auth sistemi YAPMA)
6. Test: yetki kontrollü evrak listeleme, audit log kaydı doğrulama

---

## Aşama 10 — Frontend (HITL Review + Evrak Listesi)

**Dosyalar:**
- `frontend/` — Next.js app oluştur

**Yapılacak:**
1. `npx -y create-next-app@latest ./` ile Next.js projesi oluştur (non-interactive)
2. Evrak listesi sayfası:
   - SDP kodu, birim, durum, süre uyarısı görünür
   - Filtreleme: duruma göre, birime göre
   - Responsive tablo
3. HITL review ekranı:
   - Reader sonuçları: AI kararı, mevzuat eşleşmeleri — onay/düzeltme/ret butonları
   - Writer taslağı: orijinal vs AI önerisi, diff view, düzenleme alanı
   - Onay/reddet butonları
4. Evrak detay sayfası: timeline/audit trail görünümü
5. Basit login ekranı (memur / sube_muduru seçimi)
6. Modern, premium tasarım — karanlık mod, glassmorphism, micro-animasyonlar
7. Backend API'ye `fetch`/`axios` ile bağlan (CORS zaten konfigüre)

**Doğrulama:**
```bash
docker-compose up --build
# localhost:3000 'da frontend çalışmalı
```

---

## Aşama 11 — Multi-Tenant Config + Metrikler

**Dosyalar:**
- `backend/app/tenants/kurum_config.py` — genişlet
- `backend/app/api/routes.py` — metrik endpoint'leri ekle

**Yapılacak:**
1. İkinci kurum profili ekle (örn. "İl Özel İdaresi"):
   - Farklı haberleşme kodu
   - Farklı SDP alt kümesi (opsiyonel)
   - Farklı birim yapısı
2. Kurum seçimi: login veya URL parametresi ile
3. Metrik endpoint'i `GET /metrikler`:
   - Ortalama işlem süresi (evrak yaşı ortalaması)
   - HITL'e düşme oranı (confidence < 0.7 olan evrakların yüzdesi)
   - LiteLLM üzerinden dönen maliyet bilgisi (litellm.success_callback ile)
   - Toplam evrak sayısı, duruma göre dağılım
4. Demo senaryosu hazırla: 5-10 örnek evrak ile tam akış gösterimi
5. `README.md`'yi son haliyle güncelle

**Doğrulama:**
```bash
docker-compose up --build
curl http://localhost:8000/metrikler
# Demo: 2 farklı kurum profili ile evrak yükle ve işle
```

---

## Mimari Referans

```
┌─────────────────────────────────────────────────┐
│              AI AJAN KATMANI (üst katman)         │
│   Router · Reader · Writer · Kolektif Hafıza      │
└─────────────────────┬─────────────────────────────┘
                       │ okur / yazar
┌─────────────────────▼─────────────────────────────┐
│           EBYS ÇEKİRDEK KATMANI (temel, MVP)        │
│  ├─ Evrak Kayıt & Numaralandırma (SDP formatlı)    │
│  ├─ Standart Dosya Planı (SDP) Modülü              │
│  ├─ İç Gönderim / Routing                          │
│  ├─ Basit Onay/Durum Zinciri                       │
│  ├─ Süre Takibi (basit uyarı)                      │
│  ├─ Denetim/Audit Log                              │
│  └─ Basit Rol Bazlı Yetkilendirme (RBAC)           │
└─────────────────────────────────────────────────────┘
```

**Ana akış:** Evrak girişi → AnyDoc OCR → Evrak Kayıt (SDP numaralandırma)
→ Router (birim + SDP sınıflandırma) → Reader (anlamlandırma + mevzuat RAG)
→ HITL #1 → Writer (taslak üretimi) → HITL #2 → Onay zinciri → Çıktı
→ Düzeltmeler kolektif hafızaya yazılır.

## Tech Stack

- Backend: Python 3.11+, FastAPI
- Orchestration: LangGraph (supervisor pattern, HITL interrupt)
- LLM: LiteLLM (model_config.yaml'dan)
- OCR: Firecrawl AnyDoc
- Vektör DB: Qdrant
- Ana DB: PostgreSQL
- Frontend: Next.js + React
- Deployment: Docker Compose
