# 10 — Operations

## Prerequisites

Three services must be reachable before the assistant and search work:

1. **Qdrant** — defaults to EVREN's hosted, team-isolated instance. Fill in
   `QDRANT_API_KEY` and `QDRANT_PREFIX`; collections are created on first use.
   For offline work run a local one (`docker compose up -d qdrant`, or the
   Windows binary via `npm run qdrant:dev`) and point `QDRANT_URL` at it with
   the key and prefix left empty.
2. **Docling service** — `services/docling-service`. Locally:
   `pip install -r requirements.txt` then `npm run docling:dev` (port 8100).
   Deployment recipes for Docker, systemd, and NSSM are in the
   [README](../README.md).
3. **EVREN inference service** — chat models and `bge-m3-embed` embeddings.

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Notes |
| --- | --- | --- |
| `EVREN_API_KEY` | **yes** | `sk-evren-teamNN-XXXXXXXX`; separate from the platform login |
| `EVREN_BASE_URL` | | default `https://evren-llmapi.ssyz.org.tr/v1` |
| `DATABASE_URL` | **yes** | PostgreSQL; a pooled Supabase URL (6543, PgBouncer transaction mode) works — the client already runs `prepare: false` |
| `SESSION_SECRET` | **yes** | long random string; there is an insecure dev default |
| `EMBEDDING_MODEL` | | default `bge-m3-embed` (1024 dims). **Changing it requires recreating every collection and re-indexing everything** |
| `QDRANT_URL` | | default `https://evren-vektor.ssyz.org.tr` |
| `QDRANT_API_KEY` | | different key from the LLM one |
| `QDRANT_PREFIX` | | team path segment, e.g. `team07`; unused for local Qdrant |
| `DOCLING_SERVICE_URL` | | default `http://localhost:8100` |
| `DOCLING_SHARED_SECRET` | | empty disables auth; **set it as soon as the service leaves localhost** |
| `*_AGENT_MODEL` (×10) | | per-agent overrides — see [04 — Agents](04-agents.md) |

## First run

```bash
cp .env.example .env.local     # then fill EVREN_API_KEY, DATABASE_URL, SESSION_SECRET
npm install
npm run db:push                # push the Drizzle schema
npm run db:seed                # demo institutions, departments, roles, users, corpus
npm run db:reindex-mevzuat     # embed the seeded articles into Qdrant
npm run dev
```

`db:reindex-mevzuat` is not optional after a fresh seed. `seed.ts` writes
straight to Postgres with `db.insert(mevzuatMaddeleri)`, bypassing the indexing
path in `lib/mevzuat`, so the seeded articles exist only as rows and retrieval
cannot return them. That is exactly why a bilgi-edinme request quoting 4982 once
came back with six teacher-overtime articles.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:push` | drizzle-kit (loads `.env.local` explicitly — drizzle-kit's own dotenv only reads `.env`) |
| `npm run db:seed` | 2 demo institutions, 8 departments, 3 roles, ~15 staff users (password `ebys123`), templates, a small mevzuat corpus |
| `npm run db:ingest-kurumlar` | one-off: adds MEB + Elazığ Valiliği with demo staff and bulk-ingests every PDF under `data/`. Routes each document to the mevzuat pipeline or the knowledge-base pipeline **based on its own parsed content**, not its filename or folder. Safe to re-run |
| `npm run db:reindex-mevzuat` | re-embeds the whole corpus; `-- --kuru` inspects without writing. Idempotent — a Qdrant point id is the article's Postgres id, so a re-run overwrites in place |
| `npm run docling:dev` | the parsing service on :8100 |
| `npm run qdrant:dev` | local Qdrant from `.qdrant/` |

Two more maintenance scripts exist but are not wired to npm scripts:
`src/scripts/migrate-ekler.ts` and `src/scripts/seed-vatandas.ts`.

## Build configuration

`next.config.ts` carries three settings that are not cosmetic:

- **`serverExternalPackages: ["@react-pdf/renderer", "docx"]`** —
  `@react-pdf/renderer` drives React's reconciler, which does not exist in the
  `react-server` build the RSC layer uses. Loading it externally makes Node
  resolve the normal React build instead of crashing on a missing internal.
  `docx` is external for the same class of reason.
- **`outputFileTracingIncludes: { "/api/**": ["./assets/fonts/**"] }`** — the
  PDF renderer reads the Tinos TTFs from disk at request time. Next cannot see
  that through `fs.readFile`, so a traced or standalone deploy would ship
  without them and every PDF export would fail at runtime.
- **`serverActions.bodySizeLimit: "15mb"`** — attachments go through Server
  Actions.

## Deploying

**Next.js app** — any Node host. Set every variable above; `SESSION_SECRET` and
`DATABASE_URL` are mandatory. `npm run build && npm run start`.

**Docling service** — must be reachable from the app. Docker, systemd, or NSSM
(`install-windows-service.ps1` also opens port 8100 in Windows Firewall). Set
`DOCLING_SHARED_SECRET` on **both** sides the moment it is not on localhost.
Port 8100 must be open in the firewall and, in a cloud environment, the security
group.

**Postgres** — Supabase's pooled URL works as-is.

**Qdrant** — EVREN's hosted instance by default; each team sees only its own
collections.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Assistant answers with no sources | Corpus is in Postgres but not indexed → `npm run db:reindex-mevzuat`; re-upload knowledge-base documents |
| Retrieval returns unrelated articles | Usually the same thing. If the embedding model changed, recreate the collections and re-index — vectors from different models are not comparable |
| `Belge ayrıştırma servisi hata döndürdü` | Docling is down, unreachable, or the shared secret differs between the two sides |
| Qdrant connection failures on https | Port must be derived and passed explicitly; the client silently appends 6333 otherwise (already handled in `lib/vektor/qdrant.ts` — do not reintroduce the bug) |
| Upload dies mid-write | Do **not** add a `timeout` to the Qdrant client. The option is milliseconds: a value of `600` means 0.6 s and killed 40-point upserts at 617 ms |
| Reader agent returns HTTP 500 every time | A Zod schema reached EVREN with `additionalProperties` (e.g. `z.record`). Guided decoding rejects it — keep agent schemas closed |
| Every case shows "normal" priority and a truncated summary | Same cause as above; check the server logs for `Reader agent başarısız` |
| `ContextWindowExceededError` on ingest | Two articles merged because OCR missed a `MADDE` header. `EMBED_METIN_SINIRI` caps the embedding input at 6000 chars; check the split |
| Every classification reports 0.95 confidence | Expected from the model's self-report — the agreement ceiling in `router.ts` is what makes the number meaningful. Confirm the lexical ranking is running |
| PDF export fails only in production | Font tracing — see `outputFileTracingIncludes` above |
| Registry numbers show `000.00` | The Router does not currently return an SDP code; `yeniKayitNo` substitutes the placeholder |
| A role edit did not take effect | Two reasons: `rolDegisikliginiYay` must re-apply it to existing holders, and permission flags live in the session, so the holder must log in again |

## Demo credentials

After `npm run db:seed`, every demo account uses the password `ebys123`.
Representative users:

| Username | Role | Institution / department |
| --- | --- | --- |
| `memur_fen` | Memur (1) | Örnek Belediye / Fen İşleri |
| `mudur_fen` | Şube Müdürü (2) | Örnek Belediye / Fen İşleri |
| `baskan_fen` | Daire Başkanı (3) | Örnek Belediye / Fen İşleri |
| `memur_imr`, `mudur_imr` | 1, 2 | Örnek Belediye / İmar ve Şehircilik |
| `memur_nufus`, `mudur_nufus` | 1, 2 | Örnek İlçe Kaymakamlığı / Nüfus |
| `baskan_sosyal` | 3 | Örnek İlçe Kaymakamlığı / Sosyal Yardımlaşma |
| `sistem_admin` | system administrator | — |

Fen İşleri and Sosyal Yardımlaşma are seeded with `onayZinciriSeviyeleri
"[2,3]"`, so they exercise the **two-level** approval chain; the rest use
`"[2]"`.

## Data directory

```
data/
├── evrak-ekleri/<ekId>/       citizen attachments
├── sohbet-ekleri/<sohbetId>/  chat attachments
└── (corpora and historical SQLite backups from before the Postgres migration)
```

`.gitignore` covers `data/sohbet-ekleri/`, `data/**/*.pdf`, and the legacy
SQLite files, but **not** `data/evrak-ekleri/` — worth adding if real citizen
uploads ever land in a tracked checkout.

Deleting a conversation removes its rows, its files, and its vectors together.
