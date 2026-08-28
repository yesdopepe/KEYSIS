# 06 — Retrieval & RAG

## Three collections, deliberately separate

[`src/lib/vektor/qdrant.ts`](../src/lib/vektor/qdrant.ts) defines exactly three
Qdrant collections, all cosine, all 1024-dimensional:

| Collection | Holds | Scoped by | Unit |
| --- | --- | --- | --- |
| `kurum_belge_parcalari` | institution knowledge base | `kurumId` (`must`) | ~900-char chunk |
| `mevzuat_maddeleri` | legislation corpus | `kurumId` **or** `global` (`should`) | one article |
| `sohbet_ekleri` | chat attachments | `sohbetId` **and** `kurumId` (`must`) | ~900-char chunk |

The separation is a guarantee, not an optimisation: **a file uploaded to one
conversation can never surface in an institution-wide search**, because it is
not in that collection at all.

Filters follow one convention — `must` clauses are ANDed (tenant scoping),
`should` clauses are ORed (this institution's mevzuat **or** the global corpus).
Callers must always pass the tenant filter in `must`; a search with no tenant
scoping would read across institutions.

### The `global` sentinel

Qdrant filters match concrete values, so a mevzuat article that applies to every
institution (SQL `kurum_id IS NULL`) is stored under the string `global`.
`kurumIdPayload()` is the single conversion point, so the SQL and vector sides
cannot drift.

## Embeddings

`bge-m3-embed` on the EVREN inference service, 1024 dimensions, reached through
the same provider instance as the chat models
([`lib/ai/client.ts`](../src/lib/ai/client.ts)). Unlike the e5 model it
replaced, bge-m3 is trained symmetrically, so **no** `query: ` / `passage: `
prefixing is applied.

Two operational constraints that will bite if ignored:

**Changing the model invalidates everything.** `VEKTOR_BOYUTU` must match the
model's output size, `koleksiyonlariHazirla()` only creates *missing*
collections and never resizes one, and vectors from different models are not
comparable. A model change means: recreate the collections, then re-embed and
re-upsert every piece of content. `npm run db:reindex-mevzuat` exists for the
corpus half of that.

**Long inputs are capped at 6000 characters (`EMBED_METIN_SINIRI`).** A
knowledge-base chunk is always well under it; a mevzuat "madde" is unbounded —
if OCR on a large scan misses a `MADDE` header, two articles merge and can
exceed the model's 8192-token context. That happened for real on a 22 MB scanned
yönerge. Only the *embedding input* is capped; Postgres still stores the full
text for display and citation.

Batching: 32 passages per embedding request and per Qdrant upsert
(`YIGIN_BOYUTU`). A whole document is indexed in one call from the layers above,
which for a large file is hundreds of vectors.

## Chunking

**Knowledge base** — `metniParcala()` in
[`lib/bilgi-tabani/index.ts`](../src/lib/bilgi-tabani/index.ts). Splits on
paragraph boundaries and packs them up to 900 characters so a chunk rarely cuts
a sentence in half; 150-character overlap carries the tail forward so a fact
spanning a boundary is still findable. A single oversized paragraph is hard-split.

**Mevzuat** — `mevzuatMetniParcala()` in
[`lib/mevzuat/parcala.ts`](../src/lib/mevzuat/parcala.ts). Splits on
`MADDE <n>` headers (tolerating en dash, hyphen, or no separator, since
published texts are inconsistent), because an article is the unit a document
actually cites. A short line immediately above a header becomes that article's
title — the convention in Turkish yönetmelikler (`Amaç\nMADDE 1 – …`) — and is
then stripped from the *previous* article's body where it was picked up as
trailing text. Laws often omit titles, so the fallback is
`<kanun adı> m.<n>`. The module is free of any server dependency so the parsing
rules can be exercised on their own.

## The Qdrant client

Three configuration details are load-bearing and each is commented in place:

- **Port is always derived and passed explicitly.** The client defaults to 6333
  and silently appends it even when the URL implies another (443 for https).
  EVREN's own docs call this out as a source of confusing connection failures.
- **No `timeout` override.** The option is milliseconds, not seconds — it goes
  straight into `setTimeout(() => controller.abort())` — so the `600` that once
  sat there meant 0.6 s and aborted ordinary uploads mid-write (measured: a
  16-point upsert ≈ 520 ms, a 40-point one dead at 617 ms). The client's own
  300 s ceiling remains, which is there to catch a genuinely hung connection.
- **`koleksiyonlariHazirla()` is lazy**, invoked by every read and write rather
  than at startup, because Next.js has no clean app-boot hook. It is a single
  cheap call once per process.

## Citation grounding

Every retrieval result carries an in-app `link`:

- mevzuat → `/panel/mevzuat/<id>`
- knowledge base → `/panel/kurum-belgeleri/<kurumBelgesiId>`
- chat attachment → **no link** (it is not a shared resource), cited as plain text

Three separate mechanisms then make those citations trustworthy:

1. **Prompt rule.** `asistan-agent.md` rule 1: take the address *only* from a
   tool result's `link` field, never invent or guess one.
2. **Post-filter.** `belgeTaslagiOlusturAkisli` drops any citation whose
   `referans` is not among the articles the model was actually shown, then
   attaches the real link from that lookup.
3. **Stream guard.** `dayanaksizAtifKoruyucusu` in the chat route tracks every
   internal link a tool actually returned this turn and cuts the stream the
   moment visible text cites a `/panel/...` link that is not in that set. This
   is defence in depth: unlike the drafting path (buffered, schema-validated),
   the chat endpoint streams raw tokens to the client with no checkpoint.

Guard 3 cannot catch a fabricated *claim* attached to a real link, so it
complements the prompt rule rather than replacing it.

## Lexical similarity

[`lib/search/metin-benzerligi.ts`](../src/lib/search/metin-benzerligi.ts) is a
small, dependency-free Turkish-aware token-overlap scorer. It is used for two
things:

- ranking template candidates for the Router's confidence ceiling (the
  independent second opinion described in [04 — Agents](04-agents.md));
- the Router's fallback when the LLM call fails.

It also exports the two Turkish casing helpers the rest of the app uses —
`trNormalize` (İ→i, I→ı before lowercasing) and `trUpper` (i→İ, ı→I). Plain
`toUpperCase()` gets Turkish wrong, and institution names are uppercased on
every official document.

## Document parsing

Every upload path — knowledge base, mevzuat, chat attachments, case attachments
— extracts text through one function, `dosyadanMetinCikar()` in
[`lib/docling/index.ts`](../src/lib/docling/index.ts), so they all handle a
missing service identically.

It posts to the Docling microservice's `/convert`, which returns Markdown. Two
details:

- **A 30-minute undici dispatcher.** Node's default fetch aborts after 5 minutes
  of no response, which a large scanned PDF's OCR pass can genuinely exceed —
  that is Docling still working, not a hang.
- **Bearer auth when `DOCLING_SHARED_SECRET` is set.** Empty (the local default)
  disables auth; set it the moment the service is reachable from anywhere but
  localhost, or `/convert` accepts files from anyone who can reach the port.

The citizen submission path additionally tries a plain-text fast path first
(`.txt`, `.md`, `.csv`, `.json`) and degrades to a
`[Ek Dosya: name, Boyut: n KB]` stub if conversion fails, so a broken parser
never blocks a petition.
