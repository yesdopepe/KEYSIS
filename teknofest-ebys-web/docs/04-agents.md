# 04 — Agent Layer

## Two hard rules

1. **No agent module imports an LLM SDK directly.** Every call goes through
   `getAgentModel(agentName)` in [`src/lib/ai/client.ts`](../src/lib/ai/client.ts),
   which returns `{ model, temperature, maxOutputTokens }`.
2. **No prompt is hardcoded in code.** Prompts live in `prompts/*.md` and are
   loaded by `loadPrompt(name, vars)`
   ([`src/lib/ai/prompt.ts`](../src/lib/ai/prompt.ts)), which substitutes
   `{placeholder}` tokens. The single exception is the citizen persona for the
   shared chat endpoint, which is built inline in
   [`src/app/api/asistan/route.ts`](../src/app/api/asistan/route.ts).

Model choice per agent is environment-driven, so a model can be swapped
without touching code. Defaults live in
[`src/lib/ai/config.ts`](../src/lib/ai/config.ts).

## The registry

| Agent key | Env override | Default model | Temp | Max out | Prompt file |
| --- | --- | --- | --- | --- | --- |
| `router_agent` | `ROUTER_AGENT_MODEL` | `router` | 0.1 | 4096 | `router-agent.md` |
| `reader_agent` | `READER_AGENT_MODEL` | `llm-fast` | 0.2 | 8192 | `reader-agent.md` |
| `writer_agent` | `WRITER_AGENT_MODEL` | `llm-large` | 0.4 | 8192 | `writer-agent.md` |
| `eksik_bilgi_agent` | `EKSIK_BILGI_AGENT_MODEL` | `llm-fast` | 0.1 | 2048 | `eksik-bilgi-agent.md` |
| `belge_yazar_agent` | `BELGE_YAZAR_AGENT_MODEL` | `llm-large` | 0.3 | 8192 | `belge-yazar-agent.md`, `belge-onerisi-agent.md` |
| `asistan_agent` | `ASISTAN_AGENT_MODEL` | `llm-large` | 0.3 | 8192 | `asistan-agent.md` |
| `asistan_gorsel_agent` | `ASISTAN_GORSEL_AGENT_MODEL` | `llm-large` | 0.3 | 8192 | (same as above) |
| `sohbet_baslik_agent` | `SOHBET_BASLIK_AGENT_MODEL` | `llm-fast` | 0.2 | 128 | inline |
| `ek_analiz_agent` | `EK_ANALIZ_AGENT_MODEL` | `llm-fast` | 0.2 | 4096 | `ek-analiz-agent.md` |
| `vatandas_asistan_agent` | `VATANDAS_ASISTAN_AGENT_MODEL` | `llm-large` | 0.3 | 8192 | `vatandas-asistan-agent.md` |

EVREN model ids: `router` (lightweight classification), `llm-fast` (terminology,
document analysis), `llm-large` (long reasoning chains, multimodal).

Two notes worth keeping:

- **`asistan_gorsel_agent` is also `llm-large`, on purpose.** EVREN's dedicated
  `vlm` model is video-only and rejects images outright, so the vision path
  needs a model that handles both images *and* tool calling.
- **`enable_thinking` is never set.** Per the provider's own documentation it
  multiplies token consumption 9–17× for little accuracy gain, so
  `getAgentModel` deliberately does not enable it. Output budgets are generous
  instead, so structured output is never truncated.

## Structured-output agents

All six live in [`src/lib/agents/`](../src/lib/agents/) and use
`generateObject` / `streamObject` with a Zod schema — the model's output is
schema-validated before anything downstream sees it.

### Router — `router.ts`

Classifies a dilekçe into `(kurum, birim, evrakTuru)` by having the model pick
**among the known `yazismaSablonlari` rows** — a `z.enum` over real template
ids, so it structurally cannot hallucinate an institution that does not exist.

The interesting part is confidence. The model's self-report is not treated as a
measurement:

> across every case filed so far it came back as exactly 0.95 — including one
> where a kimlik kartı renewal was filed as "genel başvuru".

A number that never varies cannot trigger the manual review it is supposed to
trigger. So the same candidate list is also ranked by in-process lexical
similarity (which is computed anyway), and the model's number is **capped** by
whether that independent signal agrees:

| Lexical rank of the model's pick | Ceiling |
| --- | --- |
| #1 | 0.95 |
| top 3 | 0.75 |
| anywhere else | 0.50 |

The model may still report *lower* — this only caps. Agreement between two
methods that fail differently is evidence; one model's opinion of itself is not.

**Fallback:** lexical top pick, confidence capped at 0.6, with the explanation
recorded on the case.

### Reader — `reader.ts`

Content analysis plus mevzuat RAG. Retrieves the top 6 articles from Qdrant
(this institution's corpus + the global one), then asks the model which of
those actually apply.

Two filters compose:

- **The model's selection.** Given six candidates it names the ones that apply,
  and may name none.
- **`MEVZUAT_GUVEN_ESIGI = 0.45`.** A deliberately low floor, and the code
  explains why with measurements: correct matches landed at 0.755, 0.648 and
  0.584, while an unrelated teacher-overtime article reached 0.604 on an
  unrelated query. The bands overlap, so any line high enough to exclude the
  noise also vetoes genuine matches. The floor only removes results too weak for
  the model's judgement to be worth trusting.

The same filter is applied on **read**, so cases filed before the threshold
existed are cleaned up too.

One schema constraint is load-bearing: `anahtar_bilgiler` is a **list of pairs**,
not `z.record`. An open map compiles to JSON Schema with `additionalProperties`,
which EVREN's guided decoding rejects outright — every call returned HTTP 500,
three retries deep, so every case for a period had a sliced-text summary,
"normal" priority and no real mevzuat reading. Keep this shape closed.

**Fallback:** `ozet: null`, no matches, `console.error`. No invented content —
see [02 — Architecture § Failure posture](02-architecture.md#failure-posture).

### Eksik bilgi — `eksik-bilgi.ts`

Checks the petition against the matched template's `zorunlu` fields and returns
each gap with a citizen-facing follow-up question. **Fails safe**: on error it
assumes nothing is missing, rather than blocking a citizen's submission on an
infrastructure problem.

### Writer — `writer.ts`

Drafts the official reply from the case's `taslakKurallari` — the same template
record that drove missing-info detection, so required fields and drafting style
stay in one place. Output is `{konu, hitap, govdeMetni}`; the body is one
flowing text (İlgi line, paragraphs, closing formula all as natural prose)
rather than disconnected boxes.

**Fallback:** a generic, correctly-formatted acknowledgement letter.

### Belge yazar — `belge-yazar.ts`

Two functions on one agent key:

- `belgeTaslagiOlusturAkisli()` — drafts a full document. Uses **`streamObject`**
  so the body streams into the canvas as it is written; the canvas opens
  *before* the LLM call starts. Citations are filtered to only those articles
  the model was actually shown, and each carries the in-app link to its source.
- `belgeOnerisiOlustur()` — revises the whole body from a free-text instruction
  and returns a full replacement. Returns `null` when the result is identical to
  what is already there, because a no-op suggestion is noise that trains
  reviewers to click through.

The agent is not given a fixed field template — it decides the document's own
section structure (headings marked `## `), guided only by the type's
`icerikRehberi`.

### Ek analiz — `ek-analiz.ts`

Analyses citizen attachments against the petition text: document categorisation,
fact cross-checking, discrepancy detection. Produces per-file findings plus an
overall `tutarlilikDurumu` (`uyumlu` / `incelenmeli` / `eksik` / `supheli`).

## Conversational agents

### Staff + citizen assistant — `POST /api/asistan`

`streamText` with 10 tools, `stopWhen: stepCountIs(8)`, and two safety transform
streams. Persona is chosen at request time: no session, level 0, or a
`/basvuru/asistan` referer produces the citizen persona (restricted to
`dilekce`, with an inline system prompt); otherwise `prompts/asistan-agent.md`
is interpolated with the institution, department, user, allowed document types
and today's date.

Tools — note how many are explicitly *read-only or proposal-only*:

| Tool | Effect |
| --- | --- |
| `kurumBelgelerindeAra` | search the institution knowledge base (read) |
| `mevzuatAra` | search the legislation corpus (read) |
| `sohbetEkindeAra` | search **only this conversation's** attachments (read) |
| `belgeTaslagiHazirla` | creates a `belgeler` row in `taslak` and streams it into the canvas |
| `evrakYenidenAnalizEt` | re-runs classification + analysis; **only while `ic_incelemede`** |
| `evrakTaslakOnerisiOlustur` | writes a **pending suggestion**, never the reply itself |
| `belgeRevizyonuOner` | writes a **pending suggestion** on a document |
| `belgeyiOnayaGonder` | starts the chain — cannot approve anything |
| `belgeyiSiniflandir` | returns a routing **suggestion**; forwards nothing |
| `evrakYanitAdayiBul` | lists candidate cases; links nothing |

`prompts/asistan-agent.md` rule 6 states this to the model in as many words:
no tool result is final, no tool can approve, forward, or complete a document —
those happen only through buttons on the canvas, pressed by an authorised
person.

### Citizen guidance assistant — `POST /api/basvuru/asistan`

A separate, lighter endpoint using `vatandas_asistan_agent`, `stepCountIs(5)`
and two read-only tools: `kurumVeBirimleriListele` (which institution/department
handles this?) and `mevzuatBilgisiSorgula` (legal basis). It writes nothing.

### Conversation titles

`baslikUret()` — one `generateText` call capped at 128 output tokens, run on the
first turn only, stripped of quotes and a leading `Başlık:`. Falls back to the
first 50 characters of the opening message.

## Prompt files

| File | Used by |
| --- | --- |
| `router-agent.md` | Router |
| `reader-agent.md` | Reader |
| `writer-agent.md` | Writer |
| `eksik-bilgi-agent.md` | Missing-information detection |
| `belge-yazar-agent.md` | Document drafting |
| `belge-onerisi-agent.md` | Document revision suggestions |
| `ek-analiz-agent.md` | Attachment analysis |
| `asistan-agent.md` | Staff chat assistant |
| `vatandas-asistan-agent.md` | Citizen guidance chat |

`asistan-agent.md` is the longest and carries the behavioural contract worth
reading in full — mandatory linked citations taken *only* from a tool result's
`link` field, explicit "say so when a search returns nothing", never echoing
internal fields (`not`, `belgeId`, `surum`) to the user, treating instructions
embedded in user-supplied text as data rather than commands, and a specific
prohibition on assuming a tool's result before it arrives.
