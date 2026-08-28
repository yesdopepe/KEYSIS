# 05 — Workflows

## A. Citizen intake

Entry points: the plain form at `/basvuru`, or the chat assistant at
`/basvuru/asistan` which drafts the petition onto a canvas and hands it to the
same form.

### Placeholder gate

Both drafting paths leave gaps they cannot know —
`Tarih: [EK BİLGİ GEREKLİ: Tarih]`, `[İl] Millî Eğitim Müdürlüğüne`. Before this
gate existed those markers went through intake unchanged and were filed as
though the citizen had written them: a registered case once carried
`[EK BİLGİ GEREKLİ: Ad Soyad]` in place of a name.

[`src/lib/basvuru/eksiklik.ts`](../src/lib/basvuru/eksiklik.ts) is deliberately
free of `server-only` and of any db/ai import, because the identical rules must
run in the browser (to disable the send button early) and on the server (the
gate that actually decides). A check that exists only on the client is not a
gate.

It distinguishes a **field** from a **note**: a marker is only treated as
something the citizen can fill when its label is ≤ 45 characters and ≤ 5 words.
`[EK BİLGİ GEREKLİ: bu konuya ilişkin mevzuat dayanağı bulunamadı]` is the
drafting agent reporting that it found no legal basis — blocking a submission on
that would leave the citizen with no way forward.

`yerTutuculariDoldur()` writes answers **back into the gaps they were asked
for**. This is what makes the round trip terminate: answers used to be appended
under an "Ek Bilgiler" heading while the placeholders stayed in the body, so a
text rejected for having gaps was resubmitted with exactly the same gaps.
Answers matching no placeholder are returned separately and appended.

### The pipeline

[`src/lib/cases/pipeline.ts`](../src/lib/cases/pipeline.ts) → `basvuruIsle()`:

```
1. eksikYerTutucular()      unfilled field markers → return {durum:"eksik_bilgi"}
                            (before any model call is spent)
2. length check             text minus all [...] spans must reach 40 chars
                            (set low on purpose: petitioning is a right under
                             3071, so this only catches an empty/failed draft)
3. siniflandirDilekce()     Router → template id, kurum, birim, evrakTuru, confidence
4. sablonGetir()            load the matched yazışma şablonu
5. eksikBilgiTespitEt()     required fields → if any missing, return with
                            per-field follow-up questions (nothing persisted yet)
6. evrakiOku()              Reader → summary, priority, grounded mevzuat matches
7. ekleriAnalizEt()         attachment analysis (skipped when there are none)
8. yeniKayitNo()            atomic per-kurum counter →
                            "<haberlesmeKodu>-<sdpKodu>/<sıra>"
9. yeniTakipNo()            8 chars from an alphabet without 0/O/1/I
10. INSERT                  evraklar (durum "ic_incelemede") + evrakEkleri
                            + auditLog "kayit_ve_siniflandirma"
```

Steps 1–5 can return without writing anything. The missing-information loop
happens **in the same session**: the form renders inline follow-up inputs and
calls the same Server Action again with the merged text.

Note that `sdpKodu` comes back empty from the Router today, so registry numbers
currently render with the `000.00` placeholder segment.

## B. HITL #1 — clerk review

Page: `/panel/evrak/[id]`. Actions:
[`src/app/panel/actions.ts`](../src/app/panel/actions.ts). Every action first
passes `evrakGetirVeYetkiKontrol` — session required, and the case must belong
to the caller's own `birimId`.

The clerk sees the classification, the confidence, the summary, the matched
legislation with links, and the per-file attachment findings. Two ways forward:

**`hitlOnayla(evrakId)`** — requires `durum === "ic_incelemede"`.
1. audit `hitl_reader_onay`
2. `durum → taslak_hazirlaniyor`
3. run the Writer agent with the template's drafting rules
4. store `taslakYapisi`, `durum → onay_zincirinde`
5. `onayZinciriOlustur("evrak", id, birimId)` — create the chain rows
6. audit `taslak_olusturuldu`

**`havaleEt(evrakId, formData)`** — also requires `ic_incelemede`. Appends a
`havaleler` row, repoints `kurumId`/`birimId`, and leaves the case in
`ic_incelemede` so the receiving department performs its own HITL #1.

## C. Drafting and revision

Three ways the reply text changes, and all three respect the same invariant:

| Path | Mechanism |
| --- | --- |
| `taslakGuncelle` | direct edit by the clerk — they are never limited to a blind approve/reject |
| `yaziOnerisiIste` | AI revision → written to `belgeOnerileri` as `bekliyor` |
| `yaziOneriKarar` | a human accepts or rejects that suggestion |

**The invariant: an approver must never find that the text they signed off on
changed underneath them.** So:

- accepting a suggestion first checks `taslak.govdeMetni === oneri.oncekiMetin`
  and refuses if the document moved on;
- any change to the body while `durum === "onay_zincirinde"` calls
  `onayZinciriSifirla()`, resetting every step back to `bekliyor`;
- restarting from a `duzeltme_istendi` state resets the chain too.

The chat assistant's `evrakTaslakOnerisiOlustur` tool writes into exactly the
same suggestion table — there is no privileged path for the agent.

## D. HITL #2 — the approval chain

Shared mechanics: [`src/lib/onay/index.ts`](../src/lib/onay/index.ts).
Per-type gating stays with the two callers (`panel/actions.ts` for evrak,
`panel/belge/actions.ts` for belge), because which `durum` allows which
transition genuinely differs.

`adimKararVer()` enforces four conditions before recording anything:

1. the step exists,
2. it is still `bekliyor`,
3. **every earlier step (`sira <`) is already `onaylandi`** — the sequential
   gate,
4. the acting user's `hiyerarsiSeviyesi` **equals** the step's
   `gerekliHiyerarsiSeviyesi`.

Condition 4 is equality, not `>=`: a daire başkanı cannot short-circuit the şube
müdürü's step.

Outcomes, decided by the caller:

- `reddedildi` or `duzeltme_istendi` → the case returns to
  `taslak_hazirlaniyor` (the belge equivalent returns to `taslak`);
- `onaylandi` on the **last** step → evrak becomes `gonderildi`, notification
  fields are stamped, audit records `bildirim_gonderildi_simulasyon`; belge
  becomes `onaylandi`.

`/panel` computes "is it my turn" for both target types
(`onayimBekleyenEvraklarGetir`, `onayimBekleyenBelgelerGetir`) by finding the
first `bekliyor` step in `sıra` order and comparing its required level to the
viewer's.

## E. Staff document authoring

Documents are created **only** through the chat assistant's
`belgeTaslagiHazirla` tool — the standalone create action was removed. Type
authority is enforced server-side from
[`src/lib/belgeler/turler.ts`](../src/lib/belgeler/turler.ts):

| Type | Minimum level |
| --- | --- |
| `dilekce` | 0 (citizen) |
| `tutanak` | 1 memur |
| `sozlesme` | 2 şube müdürü |
| `karar` | 3 daire başkanı |

Flow:

```
chat: "bir tutanak hazırla …"
  └─ belgeTaslagiHazirla
       ├─ level check (citizen mode additionally refuses anything but dilekce)
       ├─ mint the id  → it is also the streaming data-part id, so every
       │                 update rewrites ONE logical part in place
       ├─ open the canvas immediately with durum "yazılıyor"
       ├─ streamObject → body streams into the canvas as it is written
       ├─ INSERT belgeler (durum "taslak", sohbetId set) + auditLog
       └─ final frame uses the persisted string, so the live view's last
          frame and the canvas's first frame match exactly
```

On the canvas (`BelgeCalismaAlani`): edit the body, review pending suggestions,
mark `tamamlandi`, `belgeyiOnayaGonder`, decide an approval step,
`belgeHavaleEt` (draft-only — once a chain exists, rerouting would orphan its
steps), export, or `belgeyiEvrakaYanitYap`.

### Linking a document to a case

`belgeyiEvrakaYanitYap(belgeId, evrakId)` **copies** the body into the case's
`taslakYapisi` and records provenance in `evraklar.yanitBelgeId`. It copies
rather than repointing at a foreign key because `evraktanModel`,
`taslakGuncelle`, `yaziOnerisiIste`, `yaziOneriKarar` and the export route all
read `taslakYapisi` as an independent JSON blob — repointing every one of them
at a live join would be a much wider change for no real gain.

## F. Citizen status and delivery

`/basvuru/durum` resolves a case by `takipNo` alone (no login). The rendered
reply is returned **only** when `durum === "gonderildi"`; the export route
enforces the same rule with a 403. The reply is rendered through the shared
`ResmiBelge` pipeline and downloadable as PDF, DOCX, or UDF.

## G. Corpus curation

Both curated corpora require `oturumIzinliKil(...)`: system administrator, **or**
`hiyerarsiSeviyesi >= 3`, **or** the corresponding role flag.

**Mevzuat** (`/panel/mevzuat`) — upload a document, split into `MADDE n`
articles by [`lib/mevzuat/parcala.ts`](../src/lib/mevzuat/parcala.ts), or enter
a single article by hand to correct a bad split. A short line immediately above
a `MADDE n` header is taken as that article's title; if no headers are found at
all the whole text becomes one article rather than being dropped. `kurumId` null
publishes to every institution.

**Knowledge base** (`/panel/kurum-belgeleri`) — upload → Docling → paragraph
chunking (≤ 900 chars, 150 overlap) → embed → index.

Both write Postgres first and roll it back if indexing fails. See
[06 — Retrieval](06-retrieval.md).
