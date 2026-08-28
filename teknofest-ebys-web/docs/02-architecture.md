# 02 — Architecture

## Runtime topology

Four processes. The Next.js app is the only one that talks to all the others;
nothing else talks to anything.

```
                          ┌─────────────────────────────┐
   browser  ──────────────│  Next.js 16 (App Router)    │
   (citizen / staff)      │  RSC + Server Actions       │
                          │  streaming chat API routes  │
                          └──┬────────┬────────┬────────┘
                             │        │        │
              ┌──────────────┘        │        └──────────────┐
              │                       │                       │
   ┌──────────▼─────────┐  ┌──────────▼────────┐  ┌───────────▼──────────┐
   │  PostgreSQL        │  │  Qdrant           │  │  EVREN inference     │
   │  source of truth   │  │  vectors only     │  │  chat + embeddings   │
   │  (Drizzle)         │  │  3 collections    │  │  (OpenAI-compatible) │
   └────────────────────┘  └───────────────────┘  └──────────────────────┘
                             │
                  ┌──────────▼───────────┐
                  │  Docling service     │   Python / FastAPI
                  │  POST /convert       │   PDF·DOCX·image → Markdown text
                  └──────────────────────┘
```

Local disk under `./data/` holds uploaded files (`evrak-ekleri/`,
`sohbet-ekleri/`). Nothing is served from `public/` — every file goes through
an authenticated route so ownership is re-checked on each read.

## Source-of-truth rule

**PostgreSQL owns all text and metadata. Qdrant is only an index.** Every write
path follows the same order and the same failure discipline:

1. Insert the rows into Postgres (the Qdrant point id *is* the row id).
2. Embed and upsert into Qdrant.
3. If step 2 throws, **delete the rows from step 1** and surface the error.

The reason is stated in [`lib/bilgi-tabani/index.ts`](../src/lib/bilgi-tabani/index.ts):
a document listed in the UI but absent from the index is worse than one that
failed outright, because the assistant then answers as if it had never been
uploaded while the interface insists it is there. The same rollback exists in
[`lib/mevzuat/index.ts`](../src/lib/mevzuat/index.ts) — an earlier version of
the ingestion script silently lost 45 articles this way.

Deletes are symmetric: removing a knowledge-base document or a mevzuat article
removes its vectors too, or the assistant would keep citing something that no
longer exists.

## Why so few REST endpoints

Almost all mutations are **Server Actions**, not API routes. The handful of
`src/app/api/**` routes exist only where a Server Action cannot do the job:

* **Streaming** — `/api/asistan` and `/api/basvuru/asistan` return
  `UIMessageStream` responses that the client consumes token by token.
* **Binary responses** — the three `disa-aktar` routes return a file with
  `Content-Disposition`.
* **Authenticated file serving** — attachments live outside `public/`.

Everything else (approve a step, forward a case, save an edit, accept a
suggestion, create an institution) is a `"use server"` function called directly
from a form or a client component, with `revalidatePath` afterwards.

## Trust boundaries

There are three, and each is enforced at the point of use rather than by
convention:

**1. Client → server.** Any id arriving from the browser is untrusted. A
conversation is resolved by `(id, kullaniciId, kurumId)` together, never by id
alone. A document read goes through `belgeyiOkuyabilirMi`, which is applied in
*both* the page and the directly-invocable Server Action — a Server Action is
an endpoint, so a check that lives only in the page is not a check.

**2. Model → data.** `kurumId` for any retrieval call comes from the validated
session, never from a model-supplied tool argument. A tool cannot widen its own
scope: `bilgiTabanindaAra(session.kurumId, sorgu)` and
`sohbetEkindeAra(kurumId, sohbetId, …)` take the tenant from the closure, and
`ara()` in the Qdrant layer requires the caller to pass the tenant filter in
`must`.

**3. Model output → user.** The streaming assistant is the only place raw model
tokens reach a user without a schema checkpoint, so two transform streams sit in
front of it (see [09 — Security](09-security.md)): one cuts the stream on leaked
internal-reasoning artifacts, the other cuts it the moment the visible text
cites an internal link that no tool call in this turn actually returned.

## Request flow: citizen submission

```
POST (Server Action) basvuruGonder
  ├─ store each attachment to ./data/evrak-ekleri/<ekId>/
  ├─ extract text  → Docling /convert  (plain-text fast path first, then fallback)
  ├─ fill answered placeholders back into the petition body
  └─ basvuruIsle()                                       lib/cases/pipeline.ts
       ├─ reject if unfilled "[EK BİLGİ GEREKLİ: …]" markers remain
       ├─ reject if the text minus markers is under 40 chars
       ├─ siniflandirDilekce()   Router agent   → (kurum, birim, evrakTuru, confidence)
       ├─ eksikBilgiTespitEt()   required-field check against the matched şablon
       │    └─ if anything is missing → return, the form asks inline, same session
       ├─ evrakiOku()            Reader agent   → summary, priority, mevzuat matches
       │    └─ mevzuatAraVektor() → Qdrant top-6 → the model picks which actually apply
       ├─ ekleriAnalizEt()       Attachment agent → consistency + cross-check findings
       ├─ yeniKayitNo()          atomic per-kurum counter upsert
       └─ INSERT evraklar (durum = "ic_incelemede") + evrakEkleri + auditLog
```

## Request flow: staff chat turn

```
POST /api/asistan
  ├─ resolve session; no session (or referer /basvuru/asistan) → citizen persona
  ├─ pick the model: any image part in the thread → asistan_gorsel_agent
  ├─ system prompt: prompts/asistan-agent.md, interpolated with kurum/birim/user/
  │                 allowed document types/date  (citizen mode uses an inline prompt)
  ├─ streamText({ tools: 10, stopWhen: stepCountIs(8),
  │               experimental_transform: [harmony guard, citation guard] })
  └─ onEnd → persist the whole message thread; generate a title on the first turn
```

Tool results stream back into the UI as typed parts, so a reloaded conversation
renders identically to the live one — `sohbetMesajlari.parcalar` stores the
entire `UIMessage["parts"]` array, not just the text.

## Failure posture

Every agent has an explicit fallback, and they are not all the same shape,
because the right failure differs:

| Agent | On failure |
| --- | --- |
| Router | Falls back to lexical similarity, confidence capped at 0.6 |
| Reader | **No fallback content** — `ozet: null`, no mevzuat matches, logged as an error |
| Writer | Generic acknowledgement letter, marked in logs |
| Eksik bilgi | Assume nothing missing — never block a citizen on an infrastructure error |
| Belge yazar | Body becomes `[EK BİLGİ GEREKLİ: bu belge AI tarafından oluşturulamadı]` |
| Ek analiz | Basic file listing, `uygunlukDurumu: "uyumlu"` |

The Reader's choice is deliberate and documented in the code: it used to fall
back to the first 200 characters of the petition, which the case file then
displayed under "AI Analizi" — making a total outage indistinguishable from
normal operation.
