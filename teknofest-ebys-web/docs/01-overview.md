# 01 — Overview

## What this is

**e-Başvuru** is an electronic document management system (EBYS) for Turkish
public institutions, with an AI agent layer sitting on top of it. A citizen
files a petition without creating an account; the agent layer classifies it,
routes it to the right institution and department, grounds it in legislation,
detects missing information, and drafts an official reply. Every consequential
step then waits for a human with the right authority to approve it.

The guiding constraint of the whole design: **the agents propose, humans
dispose.** No tool call can approve a case, forward it, finalize a document, or
apply an edit. Those transitions exist only behind a button that a
sufficiently-senior authenticated user presses.

## The two journeys

### Citizen (no account)

```
/basvuru/asistan   chat with the assistant → it drafts a 3071-compliant dilekçe on a canvas
       ↓
/basvuru           submit: name, contact, the petition text, optional attachments
       ↓           ── AI: classify → check required fields → (ask for what's missing) →
                      read + match mevzuat → analyze attachments → register the case
       ↓
   takip no        an 8-character tracking code (no ambiguous characters — it gets read aloud)
       ↓
/basvuru/durum     track status; once answered, download the official reply as PDF / DOCX / UDF
```

### Staff (authenticated)

```
/giris        log in (username + bcrypt password) → JWT session cookie
     ↓
/panel        dashboard: cases to review, approvals awaiting *my* level, sent cases
     ↓
/panel/evrak/[id]
     ├─ HITL #1  confirm the AI's classification/analysis  → triggers the Writer agent
     │           or havale (forward) it to the correct department instead
     ├─ edit the drafted reply directly, or ask the AI for a revision (arrives as a suggestion)
     └─ HITL #2  the sequential approval chain: each required hierarchy level in order
                 → last approval sends the reply to the citizen
/panel/asistan  chat assistant with tools over the institution's own corpus; drafts
                tutanak / sözleşme / karar onto a side-by-side canvas
/yonetim        system admin: institutions, departments, roles, users
```

## Two document families, one rendering pipeline

| | **evrak** (citizen case) | **belge** (staff document) |
| --- | --- | --- |
| Originates from | `/basvuru` submission | chat assistant `belgeTaslagiHazirla` tool |
| Types | driven by `yazismaSablonlari` rows | `dilekce`, `tutanak`, `sozlesme`, `karar` |
| Reply body stored in | `evraklar.taslakYapisi` (JSON `YanitTaslagi`) | `belgeler.govdeMetni` |
| Approval | `onayAdimlari` with `hedefTuru = "evrak"` | `onayAdimlari` with `hedefTuru = "belge"` |
| AI edits | `belgeOnerileri` with `hedefTuru = "evrak"` | `belgeOnerileri` with `hedefTuru = "belge"` |
| Terminal state | `gonderildi` | `onaylandi` |

Both converge on one canonical model — `ResmiBelge` in
[`src/lib/belgeler/resmi-belge.ts`](../src/lib/belgeler/resmi-belge.ts) — so
the screen preview, the PDF, the DOCX and the UDF export all render a citizen
reply and a staff tutanak as though the same institution wrote them. Field
order and naming follow *Resmî Yazışmalarda Uygulanacak Usul ve Esaslar
Hakkında Yönetmelik*.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19 | Server Components + Server Actions; almost no bespoke REST |
| Language | TypeScript 5 (strict) | |
| Database | PostgreSQL via Drizzle ORM (`postgres-js`) | `prepare: false` — works behind PgBouncer/Supabase pooling |
| Vector store | Qdrant | 3 collections; EVREN's team-isolated hosted instance by default |
| LLM + embeddings | EVREN inference service (OpenAI-compatible) | `@ai-sdk/openai-compatible`; `bge-m3-embed`, 1024-dim |
| Agent SDK | Vercel AI SDK v7 (`ai`) | `generateObject` / `streamObject` / `streamText` + tools |
| Document parsing | Docling microservice (Python / FastAPI) | OCR + parsing for PDF, DOCX, scans |
| Auth | `jose` JWT in an httpOnly cookie + `bcryptjs` | 8-hour TTL |
| Exports | `@react-pdf/renderer`, `docx`, `fflate` (UDF) | UDF = UYAP Doküman Formatı, a ZIP of `content.xml` |
| UI | Tailwind CSS v4, shadcn-style primitives, Base UI, Phosphor icons | `Lexend` headings / `Source Sans 3` body / `Tinos` documents |

## Repository layout

```
teknofest/
├── AGENTS.md                     historical MVP roadmap (Python/LangGraph era — superseded)
└── teknofest-ebys-web/           the actual application
    ├── prompts/                  agent prompts as .md — never hardcoded in code
    ├── services/docling-service/ Python FastAPI document-conversion microservice
    ├── assets/fonts/             Tinos TTFs, embedded by the PDF renderer
    ├── data/                     runtime uploads (evrak-ekleri/, sohbet-ekleri/) + corpora
    ├── docs/                     this documentation
    └── src/
        ├── app/                  App Router: pages, Server Actions, API routes
        │   ├── api/              streaming chat, file serving, exports
        │   ├── basvuru/          citizen surface
        │   ├── panel/            staff surface
        │   ├── yonetim/          system-admin surface
        │   └── giris/            login
        ├── components/
        │   ├── ui/               design-system primitives
        │   ├── ai-elements/      chat primitives (message, tool, reasoning, artifact…)
        │   ├── belge/            document canvas, editor, previews, exports
        │   ├── sohbet/           chat layout, composer, tool-step rendering
        │   └── basvuru/          citizen assistant
        ├── lib/
        │   ├── agents/           the six structured-output agents
        │   ├── ai/               model config, provider client, prompt loader
        │   ├── auth/             sessions, guards, hierarchy thresholds
        │   ├── belgeler/         document model, renderers, exports, suggestions
        │   ├── cases/            citizen intake pipeline, registry numbering, queries
        │   ├── bilgi-tabani/     institution knowledge base (chunk + index + search)
        │   ├── mevzuat/          legislation corpus (article split + index + search)
        │   ├── onay/             shared approval-chain and havale mechanics
        │   ├── sohbet/           conversations, messages, attachments
        │   ├── vektor/           Qdrant client, embeddings, collections
        │   ├── db/               Drizzle schema, client, seed
        │   └── docling/          HTTP client for the parsing service
        └── scripts/              one-off ingestion / re-index maintenance scripts
```

## Scope boundaries

Deliberately **not** built (per the competition şartname scope, marked as TODO
where relevant): cryptographic e-signature, EYP (e-Yazışma Paketi) generation,
KEP/DETSİS integration, retention and disposal plans, classification-level
(gizlilik derecesi) management, and inter-institution external transmission.
`havale` moves a case between institutions *inside this system*, which is not
the same thing as official external correspondence.
