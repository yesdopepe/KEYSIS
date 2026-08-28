# e-Başvuru — Project Documentation

Technical documentation for the EBYS (Elektronik Belge Yönetim Sistemi) +
AI agent layer built for TEKNOFEST.

Documentation is written in English; domain identifiers stay in Turkish,
matching the codebase convention (Turkish identifiers, English comments).
See the [glossary](#glossary) below for the domain vocabulary.

## Contents

| Document | Covers |
| --- | --- |
| [01 — Overview](01-overview.md) | What the system does, the two user journeys, tech stack, repository layout |
| [02 — Architecture](02-architecture.md) | Runtime topology, the four services, request flows, trust boundaries |
| [03 — Data Model](03-data-model.md) | Every table, column semantics, relationships, the two state machines |
| [04 — Agent Layer](04-agents.md) | All ten agents, model routing, prompts, structured output, fallbacks |
| [05 — Workflows](05-workflows.md) | Citizen intake pipeline, HITL gates, approval chains, document authoring |
| [06 — Retrieval & RAG](06-retrieval.md) | Three vector collections, chunking, embedding, citation grounding |
| [07 — API & Actions](07-api-reference.md) | HTTP routes, Server Actions, chat tools, export endpoints |
| [08 — Frontend](08-frontend.md) | Page inventory, shells, the chat + canvas layout, design tokens |
| [09 — Security & Tenancy](09-security.md) | Sessions, RBAC, isolation invariants, prompt-injection and hallucination guards |
| [10 — Operations](10-operations.md) | Environment variables, setup, scripts, deployment, troubleshooting |

## Glossary

| Turkish | Meaning in this system |
| --- | --- |
| **kurum** | Institution (belediye, kaymakamlık, valilik, bakanlık) — the tenant boundary |
| **birim** | Department inside a kurum; self-referencing tree; owns the approval chain config |
| **evrak** | A case: a citizen petition registered into the system, with its whole lifecycle |
| **dilekçe** | The citizen's petition text itself |
| **belge** | A staff-authored internal document (tutanak / sözleşme / karar) or a citizen dilekçe drafted in chat |
| **takip no** | Citizen-facing 8-char tracking code, no login needed |
| **kayıt no** | Internal SDP-formatted registry number (`haberleşme_kodu-sdp_kodu/sıra`) |
| **SDP** | Standart Dosya Planı — the Turkish public-sector file classification plan |
| **mevzuat / madde** | Legislation corpus / an individual citable article (e.g. `5393/15`) |
| **yazışma şablonu** | Per (kurum, evrak türü) template: required-field schema + drafting style rules |
| **onay zinciri** | Ordered multi-level approval chain |
| **havale** | Forwarding/referral of a case or document to another kurum/birim |
| **hiyerarşi seviyesi** | 1 = memur, 2 = şube müdürü, 3 = daire başkanı; 0 = citizen (no session) |
| **öneri** | A track-changes suggestion — an AI edit that a human must accept |
| **tuval** | The document canvas beside the chat |
| **sohbet / ek** | Conversation / attachment |
| **HITL** | Human-in-the-loop — a mandatory human decision gate |
