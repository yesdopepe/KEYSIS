# 07 — API & Server Actions Reference

Most mutations are Server Actions. HTTP routes exist only for streaming, binary
responses, and authenticated file serving.

## HTTP routes

### `POST /api/asistan`

The main chat endpoint (staff **and** citizen). `maxDuration = 60`.

**Body:** `{ messages: UIMessage[], id?: string }` — `id` is the conversation id;
one is minted if absent.

**Persona selection:** no session, `hiyerarsiSeviyesi === 0`, or a referer
containing `/basvuru/asistan` → citizen persona (a fixed anonymous identity
scoped to `belediye_ornek` / `belediye_ornek:YZI`, restricted to `dilekce`, and
the conversation id is recorded in the `ebys_vatandas_sohbetler` cookie).
Otherwise the staff persona from `prompts/asistan-agent.md`.

**Model selection:** any `file` part with an `image/*` media type anywhere in the
thread switches to `asistan_gorsel_agent`.

**Response:** `createUIMessageStreamResponse` — a `UIMessageStream` with text
deltas, tool calls, tool results, and a custom `data-belge-taslak` part that
drives the live document canvas.

**Behaviour:** `stopWhen: stepCountIs(8)`, two safety transform streams, and an
`onEnd` hook that persists the full thread and generates a title on the first
turn. Errors are never forwarded raw — see `guvenliHataMesaji`.

**Tools:** `kurumBelgelerindeAra`, `mevzuatAra`, `sohbetEkindeAra`,
`belgeTaslagiHazirla`, `evrakYenidenAnalizEt`, `evrakTaslakOnerisiOlustur`,
`belgeRevizyonuOner`, `belgeyiOnayaGonder`, `belgeyiSiniflandir`,
`evrakYanitAdayiBul` (detailed in [04 — Agents](04-agents.md)).

### `POST /api/basvuru/asistan`

Citizen guidance chat. `maxDuration = 60`, `stepCountIs(5)`, no persistence,
two read-only tools: `kurumVeBirimleriListele`, `mevzuatBilgisiSorgula`.

### `POST /api/sohbet/ek`

Multipart upload of one file into one conversation.
**Fields:** `sohbetId`, `dosya`.
The conversation is created on demand (an attachment can arrive before the first
message), still scoped to the caller's user and institution. Non-images are
converted, chunked and indexed into the conversation's own vector namespace.
**Returns** `{ id, ad, tur, mimeTur, url, parcaSayisi }`, or `422` with `{hata}`.

### `GET /api/sohbet/[sohbetId]/ek/[ekId]`

Serves a chat attachment from disk. Resolved by
`(ekId, sohbetId, kurumId, kullaniciId)` together — an id alone is not enough.
`404` when the row or the file is missing.

### `GET /api/evrak/[id]/ek/[ekId]`

Serves a case attachment. `403` when the caller's session does not permit it,
`404` when the row or the file is missing.

### `GET /api/evrak/[id]/disa-aktar?format=pdf|docx|udf`

Staff export of a case's reply letter. `401` without a session, `400` on an
unknown format.

### `GET /api/belge/[id]/disa-aktar?format=pdf|docx|udf`

Staff export of a document. `401` without a session, `403` when the document
belongs to another institution, `400` on an unknown format.

### `GET /api/basvuru/[takipNo]/disa-aktar?format=pdf|docx|udf`

**Public** citizen download, keyed only by the tracking number. `403` while the
case has not reached `gonderildi`, `404` when the case or the letter is missing.

All three export routes go through `belgeDosyaYaniti()`, which lazily imports
only the renderer it needs and sets `Content-Disposition` with both an ASCII
fallback filename (Turkish transliterated) and the UTF-8 form.

## Server Actions

### `src/app/giris/actions.ts`

| Action | Notes |
| --- | --- |
| `girisYap(prevState, formData)` | bcrypt compare, `aktifMi` check, resolves the role's two permission flags, mints the JWT cookie, redirects to `/yonetim` for admins else `/panel` |
| `cikisYap()` | clears the cookie, redirects to `/giris` |

### `src/app/basvuru/actions.ts` — citizen (no session)

| Action | Notes |
| --- | --- |
| `aiDilekceOlusturAction(ozetKonu)` | one-shot "draft me a dilekçe" for the plain form |
| `basvuruGonder(input)` | stores attachments, extracts text, fills answered placeholders, runs `basvuruIsle()`; returns either `{durum:"eksik_bilgi", eksikAlanlar}` or `{durum:"tamamlandi", takipNo, evrakId}`, both with the merged text |
| `basvuruDurumSorgula(takipNo)` | status lookup; the rendered letter is returned **only** when `durum === "gonderildi"` |

### `src/app/panel/actions.ts` — case workflow

All guarded by `evrakGetirVeYetkiKontrol` (session + same `birimId`).

| Action | Requires | Effect |
| --- | --- | --- |
| `hitlOnayla(evrakId)` | `ic_incelemede` | Writer agent runs, chain created, `→ onay_zincirinde` |
| `havaleEt(evrakId, formData)` | `ic_incelemede` | records the referral, repoints kurum/birim, stays `ic_incelemede` |
| `taslakGuncelle(evrakId, formData)` | `onay_zincirinde` or `taslak_hazirlaniyor` | direct edit; resets the chain when restarting from a correction |
| `onayAdimiKarar(evrakId, adimId, karar, formData)` | `onay_zincirinde` | sequential-gate decision; last approval → `gonderildi` |
| `yaziOnerisiIste(evrakId, formData)` | — | AI revision → pending suggestion |
| `yaziOneriKarar(evrakId, karar, formData)` | — | accept (with staleness check + chain reset) or reject |

### `src/app/panel/belge/actions.ts` — document workflow

Guarded by `belgeYetkiKontrol` (same `birimId`, with the citizen-dilekçe
exception) or, for reads, `belgeyiOkuyabilirMi`.

| Action | Notes |
| --- | --- |
| `belgeGuncelle` / `belgeMetniKaydet` | save body edits |
| `belgeyiOnayaGonder(belgeId)` | creates `bekliyor` steps only — cannot write `onaylandi` |
| `belgeOnayAdimiKarar(...)` | the belge-side chain decision |
| `belgeHavaleEt(belgeId, formData)` | draft-only; once a chain exists, rerouting would orphan its steps |
| `belgeyiEvrakaYanitYap(belgeId, evrakId)` | copies the body into the case reply, records `yanitBelgeId` |
| `evrakYanitAdaylariGetir(birimId)` | read-only candidate list |
| `belgeRevizyonuOner(params)` | AI revision → pending suggestion (called by the chat tool) |
| `belgeOneriKarar(...)` | accept or reject a suggestion |
| `belgeDetayGetirAction(belgeId)` | the canvas's real read path — re-applies the read check, since a Server Action is directly invocable |

### `src/app/panel/asistan/actions.ts`

`sohbetAdiniDegistir(sohbetId, formData)`, `sohbetiKaldir(sohbetId)` — the
delete removes rows, files on disk, and vectors.

### `src/app/panel/mevzuat/actions.ts`

`mevzuatYukle(formData)`, `mevzuatMaddesiEkleAction(formData)`,
`mevzuatMaddesiKaldir(maddeId)` — all behind `oturumIzinliKil("mevzuatYonetimi")`.

### `src/app/panel/kurum-belgeleri/actions.ts`

`kurumBelgesiYukle(formData)`, `kurumBelgesiKaldir(belgeId)` — behind
`oturumIzinliKil("bilgiTabaniYonetimi")`.

### `src/app/yonetim/**/actions.ts` — system admin

All behind `oturumYoneticiZorunluKil()` (a logged-in non-admin is redirected to
`/panel`, not `/giris`).

| File | Actions |
| --- | --- |
| `kurumlar/actions.ts` | `kurumOlusturAction`, `kurumGuncelleAction` |
| `birimler/actions.ts` | `birimOlusturAction`, `birimGuncelleAction`, `kullaniciOlusturAction`, `kullaniciRolGuncelleAction` |
| `roller/actions.ts` | `rolOlusturAction`, `rolGuncelleAction`, `rolSilAction` |

Creating or updating a department also syncs its catch-all correspondence
template; updating a role re-applies it to every user holding it.

## Shared library entry points

| Module | Key exports |
| --- | --- |
| `lib/cases/pipeline` | `basvuruIsle` |
| `lib/cases/kayit-no` | `yeniTakipNo`, `yeniKayitNo` |
| `lib/cases/queries` | `birimEvraklariGetir`, `onayimBekleyenEvraklarGetir`, `onayimBekleyenBelgelerGetir`, `evrakDetayGetir`, `tumKurumVeBirimler` |
| `lib/onay` | `onayZinciriOlustur`, `onayAdimlariGetir`, `adimKararVer`, `onayZinciriSifirla`, `havaleKaydet` |
| `lib/mevzuat` | `mevzuatBelgesiEkle`, `mevzuatMaddesiEkle`, `mevzuatAraVektor`, `mevzuatMaddeleriniListele`, `mevzuatMaddesiGetir`, `mevzuatMaddesiSil` |
| `lib/bilgi-tabani` | `metniParcala`, `kurumBelgesiEkle`, `bilgiTabanindaAra`, `kurumBelgeleriniListele`, `kurumBelgesiGetir`, `kurumBelgesiSil` |
| `lib/sohbet` | `sohbetGetir`, `sohbetleriListele`, `vatandasSohbetleriListele`, `sohbetiSagla`, `mesajlariGetir`, `mesajlariKaydet`, `sohbetiYenidenAdlandir`, `sohbetiSil`, `sohbetEkiEkle`, `sohbetEkindeAra` |
| `lib/belgeler/*` | `ResmiBelge`, `govdeBloklariniAyir`, `belgedenModel`, `evraktanModel`, `belgeDosyaYaniti`, `bekleyenOnerileriGetir`, `oneriEkle`, `oneriKararKaydet`, `belgeyiOkuyabilirMi` |
| `lib/auth` | `createSession`, `getSession`, `destroySession`, `oturumZorunluKil`, `oturumYoneticiZorunluKil`, `oturumIzinliKil` |
| `lib/vektor/qdrant` | `KOLEKSIYONLAR`, `ara`, `noktalariEkle`, `noktalariSil`, `noktalariFiltreyleSil`, `sorguGomVektoru`, `pasajGomVektorleri` |
