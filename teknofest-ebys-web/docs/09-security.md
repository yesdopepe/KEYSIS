# 09 — Security & Tenancy

## Authentication

Staff sessions are a JWT (HS256, `jose`) in an httpOnly cookie named
`ebys_session`, 8-hour TTL, `secure` in production, `sameSite: "lax"`.
Passwords are bcrypt (`bcryptjs`).

The payload is intentionally small and self-contained, so guards need no round
trip:

```ts
{ userId, kullaniciAdi, adSoyad, kurumId, birimId,
  hiyerarsiSeviyesi, unvan, sistemYoneticisiMi,
  mevzuatYonetimi, bilgiTabaniYonetimi }
```

The last two are resolved from the user's role **at login** — unlike
`hiyerarsiSeviyesi`/`unvan`, they have no legacy hand-set data to preserve, so
they live only in the session rather than on the user row. A consequence worth
knowing: **a role change takes effect on the holder's next login**, not
immediately.

`aktifMi` is checked at login. Deactivating an account is the revocation path;
rows are never deleted, because `kullanicilar` has wide FK fan-in.

Citizens have **no session at all**. `/basvuru` and `/basvuru/durum` are open;
the only citizen state is `ebys_vatandas_sohbetler`, an httpOnly 30-day cookie
holding up to 50 conversation ids so a browser can find its own drafts again.

## Authorization

Three guards, in [`lib/auth/require-session.ts`](../src/lib/auth/require-session.ts):

| Guard | Behaviour |
| --- | --- |
| `oturumZorunluKil()` | redirect to `/giris` without a session |
| `oturumYoneticiZorunluKil()` | admin only; a logged-in non-admin goes to `/panel`, not `/giris` |
| `oturumIzinliKil(izin)` | feature-area permission, three grant paths |

`oturumIzinliKil` grants access when **any** of these holds:

1. `sistemYoneticisiMi` — the seeded system admin has `hiyerarsiSeviyesi 1` and
   no role, so both other paths are false for it; without this the account that
   administers everything else could not upload a single mevzuat article, and
   `/yonetim` covers only kurum/birim/rol.
2. `hiyerarsiSeviyesi >= 3` — legacy seviye-3 users keep the access they had
   before roles existed.
3. the role flag (`mevzuatYonetimi` / `bilgiTabaniYonetimi`) — an *additional*
   grant path, not a replacement.

Thresholds live in [`lib/auth/seviyeler.ts`](../src/lib/auth/seviyeler.ts), in a
plain module rather than beside the actions that enforce them, because a
`"use server"` file may only export async functions and UI code needs to read
them to decide what to offer. The actions still re-check server-side.

### Hierarchy levels

`0` citizen (no session) · `1` memur · `2` şube müdürü · `3` daire başkanı.

They gate three things: which document types you may author
(`izinliBelgeTurleri`), which approval step is yours (**equality**, not `>=` —
a daire başkanı cannot short-circuit the şube müdürü's step), and which
curation surfaces you can reach.

## Tenant isolation

The invariants, each enforced where it is used rather than by convention:

| Resource | Rule |
| --- | --- |
| evrak | `evrak.birimId === session.birimId` for every read and write in `panel/actions.ts` |
| belge | `belgeyiOkuyabilirMi()` — own department, or the citizen-dilekçe exception |
| sohbet | resolved by `(id, kullaniciId, kurumId)` **together** |
| sohbet eki | resolved by `(ekId, sohbetId, kurumId, kullaniciId)` together |
| knowledge base | `kurumId` denormalised onto every chunk; retrieval filters on it in `must` |
| mevzuat | `kurumId = session.kurumId` **OR** `IS NULL` (global corpus) |
| exports | evrak/belge routes require a session and the institution match; the citizen route requires `durum === "gonderildi"` |

Two of these were bugs that got fixed, and the fixes are worth preserving:

**Read paths needed guarding too.** Only the write paths originally checked
ownership. `BelgeTuvali`, `/panel/belge/[id]` and `belgeDetayGetirAction` all
resolved a document by id alone, so any logged-in user handed an id could read
another institution's document in full — `yetkili` gated only the *buttons*.
`belgeyiOkuyabilirMi` now mirrors `belgeYetkiKontrol` exactly, and is applied in
the Server Action as well as the page, because **a Server Action is directly
invocable**.

**A tool argument is not a scope.** Every retrieval takes `kurumId` (and
`sohbetId`) from the validated session or conversation record, never from what
the model passed in.

## Guarding model output

### Prompt-injection posture

`asistan-agent.md` rule 7 tells the model to treat instructions embedded in
user-supplied text as **data, not commands**. That is a mitigation, not a
guarantee — the real protection is that the tool surface cannot do anything
irreversible. There is no tool that approves, forwards, finalises, or applies an
edit. The worst outcome of a successful injection is a misleading message and a
pending suggestion that a human then reads.

### Two stream guards

Both are `TransformStream`s in the chat route, both keep a **bounded tail** so
they never grow with reply length, and both raise a subclass of
`GuvenlikDurdurmaHatasi` so `onError` can show one safe message class without
knowing about each.

**`harmonyKacagiKoruyucusu` — leaked internal reasoning.** Some Harmony-trained
models (e.g. gpt-oss) emit hidden `analysis`/`commentary` channels through the
`reasoning` delta field the AI SDK already keeps out of visible text. But
Harmony channel routing on the serving side is known to fail under streaming +
tool calls — the same class of bug is reported against vLLM
(`vllm-project/vllm#27641`) and TensorRT-LLM (`NVIDIA/TensorRT-LLM#9256`), and
EVREN's backend is vLLM-based. When it fails, that hidden channel's raw text —
including any *invented tool results* the model narrates while "thinking" —
lands directly in the visible stream. The patterns matched are literal Harmony
artifacts (`assistantcommentary`, `to=functions.*`, `<|channel|>`) that no
legitimate Turkish reply would contain, so the cut is safe regardless of what
the prompt says: the fabrication already happened in a channel no prompt
instruction can reach. Tail: 240 characters.

**`dayanaksizAtifKoruyucusu` — unfounded citations.** Tracks every internal
`/panel/...` or `/basvuru/asistan...` link that a tool result in this turn
actually returned, and cuts the stream the moment visible text cites one that is
not in that set. This exists because, unlike the drafting path (`generateObject`,
buffered and schema-validated before anything reaches a user), the chat endpoint
streams raw tokens with no checkpoint. It cannot catch a fabricated *claim*
attached to a real link, so it complements rule 1 rather than replacing it.
Tail: 2000 characters — long enough to hold a full `[başlık](/panel/...)`
citation split across several deltas.

### Never forward a raw error

`guvenliHataMesaji()` returns the detector's own message for a
`GuvenlikDurdurmaHatasi` and a generic Turkish message for everything else,
applied at both the outer stream and the inner `streamText`-to-UI conversion.

## File handling

- Uploads land under `./data/`, **never** in `public/`, and are served through
  routes that re-check ownership on every read.
- Stored filenames are the generated `ekId` plus the original extension; the
  human-readable name is a database column, so a crafted filename cannot escape
  the directory.
- Export filenames carry both an ASCII fallback (Turkish transliterated, since
  `Content-Disposition` fallbacks must stay Latin-1) and the UTF-8 form.
- `serverActions.bodySizeLimit` is 15 MB.

## Known limitations

Stated plainly, because they are deliberate scope decisions rather than
oversights:

- **No CSRF token beyond Next.js's built-in Server Action protections.**
- **No rate limiting** on `/basvuru` or the chat endpoints.
- **No e-signature.** Approval is recorded in `onayAdimlari`, not
  cryptographically signed.
- **Citizen tracking numbers are the only credential** for status lookup and
  reply download. The alphabet is 32 characters over 8 positions (~10^12), but
  there is no lockout on guessing.
- **`SESSION_SECRET` has an insecure development default** — it must be set in
  any real deployment.
- **Attachment text is sent to the EVREN inference service** for embedding and
  analysis; nothing is processed on-device.
- **Role permission changes apply at next login**, since they are carried in
  the session payload.
