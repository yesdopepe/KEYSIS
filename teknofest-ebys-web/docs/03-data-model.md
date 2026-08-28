# 03 — Data Model

Schema: [`src/lib/db/schema.ts`](../src/lib/db/schema.ts) (Drizzle, PostgreSQL).
19 tables. Every timestamp is `timestamptz`. Several columns hold JSON as
`text` — noted below where that matters.

## Entity map

```
kurumlar ─┬─< birimler (self-referencing via parentBirimId)
          │      └─< kullanicilar >── roller
          ├─< yazismaSablonlari        (per kurum × evrakTuru)
          ├─< mevzuatMaddeleri         (kurumId NULL = global corpus)
          ├─< kurumBelgeleri ──< kurumBelgeParcalari
          ├─< evrakSayaclari           (1:1, registry sequence)
          ├─< evraklar ──< evrakEkleri
          ├─< belgeler
          └─< sohbetler ─┬─< sohbetMesajlari
                         └─< sohbetEkleri

polymorphic on (hedefTuru ∈ {evrak, belge}, hedefId):
   onayAdimlari · havaleler · belgeOnerileri
```

The three polymorphic tables are the reason a citizen reply and a staff
document share one approval concept instead of two parallel ones.

## Organisation and identity

### `kurumlar` — institutions

`id` · `ad` · `haberlesmeKodu` (the `B.10.1.TKH.0.73.00.00`-style code that
prefixes every registry number) · `aciklama` (admin-authored context, fed to the
router through the department's catch-all template) · `createdAt`.

The tenant boundary. Every scoped query filters on it.

### `birimler` — departments

`id` (`<kurumId>:<kod>`) · `kurumId` · `ad` · `kod` · `parentBirimId`
(self-referencing org chart) · `sdpKoduBaslangic` / `sdpKoduBitis` (the SDP range
this department handles) · **`onayZinciriSeviyeleri`** · `aciklama`.

- `onayZinciriSeviyeleri` is a JSON array of hierarchy levels that must approve
  **in order** — `"[2]"` = şube müdürü only; `"[2,3]"` = şube müdürü, then daire
  başkanı. This is the only place approval depth is configured.
- `unique(kurumId, kod)` — templates resolve their department by
  `kurumId + kod`, and `kod` became admin-typed once `/yonetim` existed, so the
  uniqueness that used to hold by luck is now a real constraint.
- A non-empty `aciklama` keeps a catch-all `yazismaSablonlari` row in sync
  (`lib/birimler.ts`), which is what makes a department with no hand-authored
  template reachable by the router at all. Clearing it deletes that row, so a
  department an admin no longer wants as a catch-all stops absorbing
  submissions.

### `roller` — roles

`ad` · `aciklama` · `onaySeviyesi` (nullable — null means this role never
participates in an approval chain) · `mevzuatYonetimi` · `bilgiTabaniYonetimi`.

### `kullanicilar` — staff users

`kullaniciAdi` (unique) · `sifreHash` (bcrypt) · `adSoyad` · `kurumId` ·
`birimId` · **`hiyerarsiSeviyesi`** (1 memur / 2 şube müdürü / 3 daire başkanı) ·
`unvan` · `rolId` (nullable) · `sistemYoneticisiMi` · `aktifMi`.

Assigning a role **denormalizes** `onaySeviyesi` into `hiyerarsiSeviyesi` and
`ad` into `unvan` on the user row rather than being read live, so every existing
consumer of those two columns keeps working unchanged. The consequence: editing
a role must re-apply it to everyone holding it — that is `rolDegisikliginiYay()`
in [`lib/roller.ts`](../src/lib/roller.ts), and skipping it silently drifts.

`aktifMi` is the access-revocation switch, checked at login. Users are never
deleted, because `kullanicilar` has wide FK fan-in (belgeler, sohbetler,
kurumBelgeleri, havaleler, …).

## Routing and knowledge

### `yazismaSablonlari` — correspondence templates

`kurumId` · `evrakTuru` · `ad` · **`gerekliAlanlar`** (JSON
`Array<{alan, aciklama, zorunlu}>`) · **`taslakKurallari`** · `ilgiliBirimKodu`.

One row is the concrete answer to "how should petitions of this kind be written
to this institution", and it drives **two** separate features from one place:
the required-field schema powers missing-information detection, and the drafting
rules power the Writer agent. For a department's auto-generated catch-all
template, `taslakKurallari` also carries the admin's own description of what the
department handles — which is why the Router is shown a truncated form of it as
a routing hint.

### `mevzuatMaddeleri` — legislation corpus

`kodu` (e.g. `5393/15`) · `baslik` · `icerik` · `kurumId` (**NULL = visible to
every institution**) · `embedding` (legacy, unused — vectors live in Qdrant).

The unit is the *article*, not a fixed-size chunk, because an article is what a
document actually cites.

### `kurumBelgeleri` / `kurumBelgeParcalari` — institution knowledge base

Documents an authorized user uploads ahead of time (yönetmelik, genelge,
internal procedure) plus their retrieval chunks. `kurumId` is **denormalized
onto the chunk** so every retrieval filters by institution in one `WHERE` —
cross-tenant leakage would otherwise be one forgotten join away.

## Cases

### `evraklar` — citizen cases

| Column | Meaning |
| --- | --- |
| `takipNo` | citizen-facing tracking code, unique; alphabet excludes `0/O/1/I` |
| `kayitNo` | internal SDP registry number, unique, assigned at classification |
| `kurumId` / `birimId` / `evrakTuru` / `sdpKodu` | routing result |
| `basvuruSahibiAdSoyad` / `basvuruSahibiIletisim` | applicant |
| `rawText` / `dosyaAdi` | the petition text and originating file name |
| `confidence` | Router confidence **after** the agreement ceiling is applied |
| `eksikBilgiler` | JSON `string[]` |
| `analizOzeti` / `onceligi` / `mevzuatEslesmeleri` | Reader output (`normal` / `acil` / `gunlu`) |
| `ekAnalizi` | JSON `EkAnalizSonucu` — attachment analysis |
| `taslakYapisi` | JSON `YanitTaslagi` `{konu, hitap, govdeMetni}` — the reply |
| `yanitBelgeId` | provenance only: a chat-authored belge whose text was copied in |
| `durum` | state machine, below |
| `bildirimGonderildiMi` / `bildirimZamani` | notification simulation |

`yanitBelgeId` is deliberately *not* a live join. `taslakYapisi` stays the
independent, editable source of truth for export and approval, so the two
records never need to be kept in sync after the copy.

### `evrakSayaclari` — registry sequence

`kurumId` (PK) · `sonSayac`. A dedicated row plus an atomic
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` avoids the classic
`SELECT count(*)` then `INSERT` race: the code between those two points awaits
several LLM calls, so two submissions started close together could easily both
read the same count and be handed the same registry number.

### `evrakEkleri` — case attachments

`ad` · `dosyaAdi` · `mimeTur` · `boyut` · `diskYolu` · `rawText` · `tur`
(`gorsel` / `belge` / `pdf`) plus the per-file AI findings: `analizOzeti`,
`uygunlukDurumu` (`uyumlu` / `incelenmeli` / `eksik` / `ilgisiz`),
`uygunlukNotu`. Files live under `./data/evrak-ekleri/<ekId>/`.

## Documents

### `belgeler` — staff-authored documents

`belgeTuru` (`dilekce` / `tutanak` / `sozlesme` / `karar`) · `baslik` · `baglam`
(the context the author gave) · **`govdeMetni`** (the whole body as flowing text
— there is no fixed set of named sections) · `kaynaklar` (JSON
`Array<{referans, aciklama, link?}>`) · `durum` · `olusturanKullaniciId` ·
`kurumId` · `birimId` · `sohbetId` (deep-links back to the conversation that
created it).

### `belgeOnerileri` — track-changes suggestions

`hedefTuru` / `hedefId` · **`oncekiMetin`** · `oneriMetin` · `gerekce` ·
`kaynak` (`ai` / `kullanici`) · `durum` (`bekliyor` / `kabul` / `red`) ·
decision fields.

An AI edit is *always* written here rather than applied directly — that is what
makes "AI and humans edit the same document" safe. `oncekiMetin` is what lets an
accept detect that the document moved on underneath a pending suggestion
instead of silently clobbering it; the accept path compares and refuses.

### `onayAdimlari` — approval chain

`hedefTuru` / `hedefId` · `sira` · `gerekliHiyerarsiSeviyesi` · `durum`
(`bekliyor` / `onaylandi` / `reddedildi` / `duzeltme_istendi`) ·
`onaylayanKullaniciId` · `yorum` · `zaman`. One row per level required by the
owning department's `onayZinciriSeviyeleri`.

### `havaleler` — forwarding trail

Append-only. `hedefTuru` / `hedefId` · old and new kurum/birim · `sebep` ·
`yapanKullaniciId` · `zaman`. A case never dead-ends on a bad initial routing
decision.

### `auditLog`

`evrakId` (nullable — belge events carry none) · `islem` · `kullanici` ·
`detay` (JSON) · `zaman`. Recorded operations include
`kayit_ve_siniflandirma`, `hitl_reader_onay`, `taslak_olusturuldu`,
`taslak_duzenlendi`, `havale`, `onay_adimi_<karar>`, `yazi_ai_onerisi`,
`yazi_oneri_<karar>`, `belge_olusturuldu_asistan`, `taslak_onerisi_asistan`,
`bildirim_gonderildi_simulasyon`.

## Conversations

### `sohbetler`

`baslik` · `kullaniciId` · `kurumId` · `birimId`. Private to its author: every
read filters on `kullaniciId` **and** `kurumId` together, so neither a colleague
nor another institution can reach one by guessing an id.

### `sohbetMesajlari`

`rol` · `sira` · **`parcalar`** — the whole `UIMessage["parts"]` array as JSON,
not just the text. Tool calls, their results, citation links and image
references all live in there, so a reloaded conversation renders identically to
the live one instead of degrading to plain text.

### `sohbetEkleri`

`ad` · `dosyaAdi` · `mimeTur` · `diskYolu` · `rawText` · `tur`
(`gorsel` / `belge`). **Deliberately not part of the knowledge base**: chunks go
into a separate Qdrant collection scoped to `sohbetId`, so an attachment can
never surface in an institution-wide search. Images carry no `rawText` — they go
to the vision model directly rather than being chunked.

## State machines

### evrak

```
                (submission)
                     │
                     ▼
              ic_incelemede ◄──── havaleEt (kurum/birim change,
                     │             state returns here)
        hitlOnayla   │
        (HITL #1)    ▼
            taslak_hazirlaniyor ──► Writer agent drafts taslakYapisi,
                     │                approval-chain rows created
                     ▼
              onay_zincirinde ◄──── taslakGuncelle (a direct edit re-enters;
                     │               restarting from a correction resets the chain)
     each level, in  │
     sıra order ─────┼── reddedildi / duzeltme_istendi ──► taslak_hazirlaniyor
                     │
             last step onaylandi
                     ▼
                gonderildi        (terminal — the reply becomes visible to the citizen)
```

`yeni` exists as the schema default and has a label, but the pipeline registers
straight into `ic_incelemede`.

### belge

```
   taslak ──► tamamlandi ──► onay_zincirinde ──► onaylandi   (terminal)
     ▲          (belgeGuncelle           │
     │           with _tamamla=1)        │
     └───────────────────────────────────┘
        a step rejects or asks for correction → straight back to taslak
```

`belgeGuncelle` refuses outright once `durum === "onaylandi"` — editing an
approved document would let its text diverge from what every approver signed.
An edit while `onay_zincirinde` is allowed but resets the chain. Note that
although `reddedildi` appears in the schema comment as a belge state, the
rejection path sets `taslak` directly, so the value is not written today.

There is no `gonderildi` for a belge — unlike a reply letter, a document has
nothing that "sends" itself, so `onaylandi` already means done. The single way a
belge's text leaves this table is `belgeyiEvrakaYanitYap`, which **copies** it
into an evrak's `taslakYapisi`.

Labels and semantic tones for every state live in one place —
[`src/lib/ui/durum.ts`](../src/lib/ui/durum.ts) — shared by both machines, since
`onay_zincirinde` / `onaylandi` / `reddedildi` mean the same thing for both.
