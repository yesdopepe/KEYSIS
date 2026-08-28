# 08 — Frontend

Next.js 16 App Router. Pages are Server Components by default; client
components appear only where interaction genuinely requires them (the chat, the
document canvas, the editor, dialogs, the theme toggle).

## Page inventory

### Public / citizen

| Route | Purpose |
| --- | --- |
| `/` | landing page — three entry cards |
| `/basvuru` | petition form: text, applicant details, attachments, inline missing-info follow-ups, "AI ile oluştur" |
| `/basvuru/asistan` | citizen assistant chat, drafts a dilekçe onto the canvas |
| `/basvuru/asistan/[sohbetId]` | a saved citizen conversation (`?belge=<id>` opens the canvas) |
| `/basvuru/durum` | status lookup by tracking number; download the reply once sent |
| `/giris` | staff login |

Public navigation (`PublicShell`): Yeni Başvuru · Dilekçe & Kurum Asistanı ·
Durum Sorgula.

### Staff

| Route | Purpose |
| --- | --- |
| `/panel` | dashboard: three stat cards, cases to review, approvals awaiting **your** level (cases and documents), sent cases |
| `/panel/evrak/[id]` | the case file — classification, analysis, mevzuat with links, attachment findings, HITL #1 controls, reply editor + suggestions, the approval chain, the audit trail |
| `/panel/asistan` | assistant, conversation list |
| `/panel/asistan/[sohbetId]` | a conversation, with the document canvas beside it |
| `/panel/belge` | "Belgelerim" |
| `/panel/belge/[id]` | full-page document workspace |
| `/panel/mevzuat`, `/panel/mevzuat/[id]` | legislation corpus + article detail (the target of every mevzuat citation) |
| `/panel/kurum-belgeleri`, `/panel/kurum-belgeleri/[id]` | knowledge base + document detail with its chunks |

Staff navigation (`StaffShell`) is permission-aware: Bekleyen İşler · Kurum
Asistanı · Belgelerim always; Kurum Bilgi Tabanı and Mevzuat appear only when
the same three grant paths `oturumIzinliKil` checks are satisfied. The comment
in the shell states the rule plainly — a link the action would refuse is worse
than no link, and so is hiding one it would allow.

### System administration

`/yonetim` · `/yonetim/kurumlar` · `/yonetim/kurumlar/[id]` (departments of one
institution) · `/yonetim/birimler` (department detail, its users, approval-chain
configuration) · `/yonetim/roller`. Behind `YonetimShell`.

## Shells

`AppShell` is the shared frame (navigation, session header, theme toggle);
`PublicShell`, `StaffShell` and `YonetimShell` are thin wrappers that supply
their own nav items and session block.

## The chat + canvas layout

Three components cooperate, and the division of labour is deliberate:

- **`SohbetDuzeni`** — sizes the chat region to the viewport.
- **`SohbetCanvasDuzeni`** — positions two slots. Both slots are *Server
  Components rendered by the page above it*; this component never reads or owns
  their data. When a tool call attaches a document mid-conversation, the chat
  client navigates (`router.replace` / `refresh`), the server page re-runs with a
  new `canvasSlot`, and that flows back down as a fresh prop.
- **`BelgeTuvali` / `BelgeTuvaliIstemci` / `BelgeCalismaAlani`** — the document
  itself: preview, editor, suggestion review, approval controls, exports.

Two decisions are worth knowing before editing this area:

**Desktop and mobile cannot both be in the DOM.** The wide/narrow split is a
media *query* (`useMedyaSorgusu`), not `md:` classes, because `chatSlot` owns
the composer and a hidden second copy would duplicate the `asistan-girdi` and
`asistan-ek` ids — which is what decides where a `<label for>` points and which
file input the attach button opens. Desktop gets resizable side-by-side panes;
mobile opens the document in a Sheet rather than splitting an already narrow
screen.

**The canvas has real open/closed state.** `acik` is state, not "does a
`canvasSlot` exist", so the × closes it and a floating pill reopens it — on both
breakpoints. Closing used to be permanent for the rest of the session on mobile.

### Live drafting

`belgeTaslagiHazirla` streams a custom `data-belge-taslak` part with a
**stable id minted before the LLM call**, so every update rewrites one logical
part in place rather than appending a new one. The canvas opens immediately
showing `durum: "yazılıyor"`; the final frame uses the exact persisted string so
the live view's last frame and the canvas's first frame match.

## Document rendering

One model, four renderers:

```
ResmiBelge  (lib/belgeler/resmi-belge.ts)
   ├─ ResmiBelgeOnizleme / DilekceOnizleme   on-screen preview (React)
   ├─ render/pdf.tsx     @react-pdf/renderer, embeds the Tinos TTFs
   ├─ render/docx.ts     docx
   └─ render/udf.ts      fflate — UYAP Doküman Formatı
```

`govdeBloklariniAyir()` turns the flowing body into typed blocks every renderer
consumes identically: `## ` lines become headings, `- ` / `* ` / `1. ` lines
become lists (kept as separate lines rather than merged into a run-on
paragraph), a single newline inside a paragraph is a soft break, and markdown
emphasis markers (`**bold**`) are stripped — the document model has no
inline-formatting concept, so an asterisk pair there is never something a person
typed on purpose.

**UDF** deserves a note: a `.udf` file is a Deflate ZIP holding a single
`content.xml` in which all text lives in one CDATA pool and the structure
elements reference it by **character offset and length**. That indirection is
the whole format, which is why offsets are computed in one pass rather than per
element. Reference: `saidsurucu/UDF-Toolkit`.

## Design system

`src/components/ui/` holds shadcn-style primitives (Base UI + Radix-adjacent
patterns): button, card, dialog, sheet, select, command, table, tabs, tooltip,
dropdown, resizable, alert-dialog, badge, empty, skeleton, spinner, and chat-
specific ones (`bubble`, `message`, `message-scroller`, `ai-chat-history`,
`attachment`, `input-group`). `src/components/ai-elements/` holds the chat
primitives: `conversation`, `message`, `prompt-input`, `reasoning`, `tool`,
`sources`, `artifact`, `attachments`, `suggestion`. `src/components/ui-eski/` is
the superseded set, kept only for components not yet migrated.

**Tokens** (`src/app/globals.css`, Tailwind v4 `@theme`):

- `--color-primary: #1e40af` — reserved for interactive elements. Body text uses
  neutral slate so it never competes with the brand colour.
- `--color-brand: #16a34a` — the highlighted-action green. Named `brand` and not
  `accent` on purpose: shadcn components hard-code `bg-accent`/`text-accent` as
  a *subtle neutral hover tint*, so putting a saturated green there would tint
  every hover state in the app. `--color-accent` stays that neutral meaning.
- `--radius-card` / `--radius-control` plus a derived `--radius-*` scale.
- Fonts: `--font-heading` Lexend, `--font-body` Source Sans 3, `--font-belge`
  Tinos. Tinos is loaded locally because **it is what the PDF export embeds** —
  the on-screen preview then matches the exported file rather than merely
  resembling it.

**Theme.** Three states — `acik`, `koyu`, `sistem` (default). The `dark` class is
applied by an inline ES5 script in `<head>` before first paint; anything waiting
for the bundle flashes the light palette for a frame. It is wrapped in
`try/catch` because `localStorage` alone throws in a browser with site data
blocked, and a failure must leave the default light theme standing rather than
an unstyled page. The toggle reads `localStorage` through
`useSyncExternalStore`, which also gets hydration handling for free.

Tailwind's content scan is extended with `@source` directives for the
`streamdown` packages, whose utility classes ship inside their own compiled JS
outside `src/**`.

## Conventions

- Turkish identifiers, English comments — throughout, including components.
- Server Actions are bound in JSX (`action={hitlOnayla.bind(null, evrak.id)}`),
  so forms work without client JavaScript wherever possible.
- Icons: `@phosphor-icons/react/ssr` (the SSR entry point, so icons render in
  Server Components).
- Every mutation ends in `revalidatePath` for the pages it affects.
