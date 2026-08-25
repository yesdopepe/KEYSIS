import { pgTable, text, integer, real, boolean, timestamp, serial, unique } from "drizzle-orm/pg-core";

/**
 * Kurumlar (institutions). Multi-institution routing is core to the demo:
 * a citizen dilekçe can land on any of these, not just one demo belediye.
 */
export const kurumlar = pgTable("kurumlar", {
  id: text("id").primaryKey(),
  ad: text("ad").notNull(),
  haberlesmeKodu: text("haberlesme_kodu").notNull(),
  // Admin-authored context (src/app/yonetim), woven into a birim's
  // catch-all yazışma şablonu — see birimler.aciklama.
  aciklama: text("aciklama"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Birimler (departments), self-referencing via parentBirimId so the org
 * chart drives both routing precision and the approval hierarchy depth.
 * onayZinciriSeviyeleri is a JSON array of hiyerarsiSeviyesi values that
 * must approve in order, e.g. "[2,3]" = şube müdürü then daire başkanı.
 */
export const birimler = pgTable(
  "birimler",
  {
    id: text("id").primaryKey(),
    kurumId: text("kurum_id")
      .notNull()
      .references(() => kurumlar.id),
    ad: text("ad").notNull(),
    kod: text("kod").notNull(),
    parentBirimId: text("parent_birim_id"),
    sdpKoduBaslangic: text("sdp_kodu_baslangic"),
    sdpKoduBitis: text("sdp_kodu_bitis"),
    onayZinciriSeviyeleri: text("onay_zinciri_seviyeleri").notNull().default("[2]"),
    // Non-empty aciklama keeps a catch-all yazışma şablonu row in sync (see
    // lib/birimler.ts) so the router agent can reach a birim that has no
    // hand-authored template — the actual mechanism this field powers.
    aciklama: text("aciklama"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // adaySablonlariGetir resolves a şablon's birim via kurumId+kod — this
    // was safe with hand-picked seed codes, but kod becomes admin-typed
    // (src/app/yonetim) from here on, so a real constraint replaces the
    // implicit uniqueness that used to just happen to hold.
    kurumKodBenzersiz: unique().on(t.kurumId, t.kod),
  })
);

/**
 * Roller (roles): admin-defined (src/app/yonetim), enforced permission
 * catalogue. Assigning a role to a kullanici denormalizes
 * onaySeviyesi/ad onto that user's hiyerarsiSeviyesi/unvan (see
 * lib/roller.ts) rather than being read live — every existing consumer of
 * those two columns (approval-chain gating, document-type gating, display)
 * keeps working unchanged, now just sourced from a role instead of
 * hand-set. onaySeviyesi null means the role never participates in an
 * approval chain (e.g. a pure viewer/uploader role).
 */
export const roller = pgTable("roller", {
  id: text("id").primaryKey(),
  ad: text("ad").notNull(),
  aciklama: text("aciklama"),
  onaySeviyesi: integer("onay_seviyesi"),
  mevzuatYonetimi: boolean("mevzuat_yonetimi").notNull().default(false),
  bilgiTabaniYonetimi: boolean("bilgi_tabani_yonetimi").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Staff users. hiyerarsiSeviyesi: 1 = memur, 2 = şube müdürü,
 * 3 = daire başkanı. Drives both what a user can approve and dashboard
 * scoping (a user only sees cases in their own kurum/birim).
 */
export const kullanicilar = pgTable("kullanicilar", {
  id: text("id").primaryKey(),
  kullaniciAdi: text("kullanici_adi").notNull().unique(),
  sifreHash: text("sifre_hash").notNull(),
  adSoyad: text("ad_soyad").notNull(),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  birimId: text("birim_id")
    .notNull()
    .references(() => birimler.id),
  hiyerarsiSeviyesi: integer("hiyerarsi_seviyesi").notNull().default(1),
  unvan: text("unvan").notNull().default("Memur"),
  // Nullable: null means this user predates the role system and keeps its
  // hand-set hiyerarsiSeviyesi/unvan untouched — see lib/roller.ts.
  rolId: text("rol_id").references(() => roller.id),
  sistemYoneticisiMi: boolean("sistem_yoneticisi_mi").notNull().default(false),
  // Access-revocation switch for a staff login, checked at girisYap — used
  // instead of deleting the row, since kullanicilar has wide FK fan-in
  // (belgeler, sohbetler, kurumBelgeleri, havaleler, ...).
  aktifMi: boolean("aktif_mi").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per (kurum, evrakTuru) correspondence template — the concrete answer to
 * "how should dilekçes be written to this institution": a required-fields
 * schema (drives missing-info detection, Görev 1) plus drafting style
 * rules (drives the Writer agent, Görev 2). One source of truth for both.
 */
export const yazismaSablonlari = pgTable("yazisma_sablonlari", {
  id: text("id").primaryKey(),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  evrakTuru: text("evrak_turu").notNull(),
  ad: text("ad").notNull(),
  // JSON: Array<{ alan: string; aciklama: string; zorunlu: boolean }>
  gerekliAlanlar: text("gerekli_alanlar").notNull().default("[]"),
  taslakKurallari: text("taslak_kurallari").notNull().default(""),
  ilgiliBirimKodu: text("ilgili_birim_kodu"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Mevzuat corpus for RAG. Matched via in-process lexical similarity
 * (see lib/search/metin-benzerligi.ts) — no vector DB needed at this
 * corpus size (~20-30 madde). `embedding` is reserved for a future upgrade
 * to real vector search and stays unused/null for now.
 */
export const mevzuatMaddeleri = pgTable("mevzuat_maddeleri", {
  id: text("id").primaryKey(),
  kodu: text("kodu").notNull(),
  baslik: text("baslik").notNull(),
  icerik: text("icerik").notNull(),
  kurumId: text("kurum_id").references(() => kurumlar.id),
  embedding: text("embedding"), // JSON float[], unused for now
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Evraklar (cases). takipNo is the citizen-facing tracking key (no login
 * needed); kayitNo is the internal SDP-formatted registry number assigned
 * once classified. durum drives the whole pipeline as a state machine.
 */
export const evraklar = pgTable("evraklar", {
  id: text("id").primaryKey(),
  takipNo: text("takip_no").notNull().unique(),
  kayitNo: text("kayit_no").unique(),

  kurumId: text("kurum_id").references(() => kurumlar.id),
  birimId: text("birim_id").references(() => birimler.id),
  evrakTuru: text("evrak_turu"),
  sdpKodu: text("sdp_kodu"),

  basvuruSahibiAdSoyad: text("basvuru_sahibi_ad_soyad").notNull(),
  basvuruSahibiIletisim: text("basvuru_sahibi_iletisim").notNull(),

  rawText: text("raw_text").notNull(),
  dosyaAdi: text("dosya_adi"),

  confidence: real("confidence"),
  // JSON string[] — what's missing per the matching yazismaSablonu
  eksikBilgiler: text("eksik_bilgiler").notNull().default("[]"),

  analizOzeti: text("analiz_ozeti"),
  onceligi: text("onceligi").notNull().default("normal"),
  // JSON: Array<{ maddeKodu, baslik, icerikOzeti, benzerlikSkoru }>
  mevzuatEslesmeleri: text("mevzuat_eslesmeleri").notNull().default("[]"),

  // JSON: YanitTaslagi (see lib/belgeler/yanit-taslagi.ts) — structured
  // fields rather than one flat blob, so the response letter renders through
  // the same official-document pipeline as staff-authored belgeler.
  taslakYapisi: text("taslak_yapisi"),

  // A chat-authored belge whose text was copied in as this case's response
  // (see belgeyiEvrakaYanitYap). Provenance only — taslakYapisi above stays
  // the independent, editable source of truth for export/approval so this
  // never needs to be kept in sync after the copy.
  yanitBelgeId: text("yanit_belge_id"),

  durum: text("durum").notNull().default("yeni"),

  bildirimGonderildiMi: boolean("bildirim_gonderildi_mi").notNull().default(false),
  bildirimZamani: timestamp("bildirim_zamani", { mode: "date", withTimezone: true }),

  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  guncellemeZamani: timestamp("guncelleme_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Ordered multi-level approval chain — one row per hierarchy level required
 * by the responsible birim's onayZinciriSeviyeleri. Replaces a single flat
 * "approved" flag. Polymorphic (hedefTuru/hedefId) the same way
 * belgeOnerileri is below, so both the citizen evrak response and a
 * chat-authored belge go through the identical sequential-gate mechanics in
 * src/lib/onay/adimlar.ts — one approval concept, not two parallel ones.
 */
export const onayAdimlari = pgTable("onay_adimlari", {
  id: serial("id").primaryKey(),
  hedefTuru: text("hedef_turu").notNull(), // evrak | belge
  hedefId: text("hedef_id").notNull(),
  sira: integer("sira").notNull(),
  gerekliHiyerarsiSeviyesi: integer("gerekli_hiyerarsi_seviyesi").notNull(),
  durum: text("durum").notNull().default("bekliyor"), // bekliyor|onaylandi|reddedildi|duzeltme_istendi
  onaylayanKullaniciId: text("onaylayan_kullanici_id").references(() => kullanicilar.id),
  yorum: text("yorum"),
  zaman: timestamp("zaman", { mode: "date", withTimezone: true }),
});

/**
 * Append-only forwarding/referral audit trail — a case or belge reassigned
 * from one kurum/birim to another (after intake, or after the agent's
 * belgeyiSiniflandir tool proposes a target and a human confirms it),
 * instead of dead-ending on a bad initial routing decision. Polymorphic for
 * the same reason as onayAdimlari above.
 */
export const havaleler = pgTable("havaleler", {
  id: serial("id").primaryKey(),
  hedefTuru: text("hedef_turu").notNull(), // evrak | belge
  hedefId: text("hedef_id").notNull(),
  eskiKurumId: text("eski_kurum_id"),
  eskiBirimId: text("eski_birim_id"),
  yeniKurumId: text("yeni_kurum_id").notNull(),
  yeniBirimId: text("yeni_birim_id").notNull(),
  sebep: text("sebep").notNull(),
  yapanKullaniciId: text("yapan_kullanici_id")
    .notNull()
    .references(() => kullanicilar.id),
  zaman: timestamp("zaman", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-kurum sequence counter for internal kayıt_no numbering. A dedicated
 * row + atomic upsert avoids the classic "SELECT count(*) then INSERT"
 * race: two submissions started close together could both read the same
 * count before either commits (the code between them awaits several LLM
 * calls), producing duplicate registry numbers.
 */
export const evrakSayaclari = pgTable("evrak_sayaclari", {
  kurumId: text("kurum_id")
    .primaryKey()
    .references(() => kurumlar.id),
  sonSayac: integer("son_sayac").notNull().default(1000),
});

/**
 * Staff-authored documents (tutanak / sözleşme / karar — internal document
 * types, distinct from the citizen-originated evraklar pipeline). Gated by
 * hiyerarşi seviyesi at creation time (see lib/belgeler/turler.ts) — a
 * memur can't author a karar. `govdeMetni` is the whole document body as
 * flowing text (see lib/belgeler/resmi-belge.ts) — there is no fixed set of
 * named sections, the author decides the structure; `kaynaklar` holds the
 * citations the drafting agent attached.
 */
export const belgeler = pgTable("belgeler", {
  id: text("id").primaryKey(),
  belgeTuru: text("belge_turu").notNull(), // tutanak | sozlesme | karar
  baslik: text("baslik").notNull(),
  baglam: text("baglam").notNull(), // the prompt/context the author gave
  // Whole document body as flowing text (see lib/belgeler/resmi-belge.ts) —
  // not a fixed set of named sections. The author decides the structure.
  govdeMetni: text("govde_metni").notNull().default(""),
  // JSON: Array<{ referans: string; aciklama: string; link?: string }>
  kaynaklar: text("kaynaklar").notNull().default("[]"),
  // taslak: being written/edited, freely.
  // tamamlandi: author is done; editable until sent to approval.
  // onay_zincirinde: an onayAdimlari chain exists and is running.
  // onaylandi: every step approved — finished, no further edits.
  // reddedildi: a step rejected it — back with the author as taslak.
  // (No "gonderildi" — unlike an evrak reply, a belge has nothing that
  // "sends" itself; onaylandi already means done. See belgeyiEvrakaYanitYap
  // for the one way a belge's text leaves this table.)
  durum: text("durum").notNull().default("taslak"),
  olusturanKullaniciId: text("olusturan_kullanici_id")
    .notNull()
    .references(() => kullanicilar.id),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  birimId: text("birim_id")
    .notNull()
    .references(() => birimler.id),
  // Set when the chat's belgeTaslagiHazirla tool created this belge, so
  // "Belgelerim" can deep-link back to the conversation that made it.
  sohbetId: text("sohbet_id"),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  guncellemeZamani: timestamp("guncelleme_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Lightweight audit log — cheap to keep, useful for the HITL demo story. */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  evrakId: text("evrak_id").references(() => evraklar.id),
  islem: text("islem").notNull(),
  kullanici: text("kullanici").notNull().default("sistem"),
  detay: text("detay").notNull().default("{}"), // JSON
  zaman: timestamp("zaman", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Track-changes suggestions against a single section of a document. An AI
 * edit is always written here rather than applied directly — a person has
 * to accept it — which is what makes "AI and humans edit the same document"
 * safe. `oncekiMetin` is kept so an accept can detect that the section
 * moved on underneath a pending suggestion instead of silently clobbering it.
 */
export const belgeOnerileri = pgTable("belge_onerileri", {
  id: serial("id").primaryKey(),
  hedefTuru: text("hedef_turu").notNull(), // belge | evrak
  hedefId: text("hedef_id").notNull(),
  oncekiMetin: text("onceki_metin").notNull(),
  oneriMetin: text("oneri_metin").notNull(),
  gerekce: text("gerekce").notNull().default(""),
  kaynak: text("kaynak").notNull().default("ai"), // ai | kullanici
  olusturanKullaniciId: text("olusturan_kullanici_id").references(() => kullanicilar.id),
  durum: text("durum").notNull().default("bekliyor"), // bekliyor | kabul | red
  kararVerenKullaniciId: text("karar_veren_kullanici_id").references(() => kullanicilar.id),
  kararZamani: timestamp("karar_zamani", { mode: "date", withTimezone: true }),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Institution knowledge base: documents an admin (hiyerarşi seviyesi 3)
 * uploads ahead of time — yönetmelikler, genelgeler, iç prosedürler. The
 * chat assistant answers only from these plus the mevzuat corpus, and cites
 * which one it used.
 */
export const kurumBelgeleri = pgTable("kurum_belgeleri", {
  id: text("id").primaryKey(),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  ad: text("ad").notNull(),
  dosyaAdi: text("dosya_adi"),
  rawText: text("raw_text").notNull(),
  yukleyenKullaniciId: text("yukleyen_kullanici_id")
    .notNull()
    .references(() => kullanicilar.id),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Retrieval chunks for the knowledge base. kurumId is denormalized onto the
 * chunk so every retrieval query can filter by institution in one WHERE —
 * cross-institution leakage would otherwise be one forgotten join away.
 */
export const kurumBelgeParcalari = pgTable("kurum_belge_parcalari", {
  id: serial("id").primaryKey(),
  kurumBelgesiId: text("kurum_belgesi_id")
    .notNull()
    .references(() => kurumBelgeleri.id),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  sira: integer("sira").notNull(),
  metin: text("metin").notNull(),
});

/**
 * A saved assistant conversation. Private to its author: every read filters
 * on kullaniciId AND kurumId together, so neither a colleague nor another
 * institution can reach one by guessing an id.
 */
export const sohbetler = pgTable("sohbetler", {
  id: text("id").primaryKey(),
  baslik: text("baslik").notNull().default("Yeni sohbet"),
  kullaniciId: text("kullanici_id")
    .notNull()
    .references(() => kullanicilar.id),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  birimId: text("birim_id")
    .notNull()
    .references(() => birimler.id),
  olusturmaZamani: timestamp("olusturma_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  guncellemeZamani: timestamp("guncelleme_zamani", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One message of a conversation. `parcalar` stores the whole UIMessage parts
 * array rather than just the text: tool calls, their results, citation links
 * and image references all live in there, so a reloaded conversation renders
 * identically to the live one instead of degrading to plain text.
 */
export const sohbetMesajlari = pgTable("sohbet_mesajlari", {
  id: text("id").primaryKey(),
  sohbetId: text("sohbet_id")
    .notNull()
    .references(() => sohbetler.id),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  rol: text("rol").notNull(), // user | assistant | system
  sira: integer("sira").notNull(),
  parcalar: text("parcalar").notNull().default("[]"), // JSON: UIMessage["parts"]
  zaman: timestamp("zaman", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A file attached to one conversation. Deliberately NOT part of the
 * institution knowledge base: its chunks live in a separate Qdrant
 * collection scoped to sohbetId, so an attachment can never surface in an
 * institution-wide search. Images carry no rawText — they go to the vision
 * model directly instead of being chunked.
 */
export const sohbetEkleri = pgTable("sohbet_ekleri", {
  id: text("id").primaryKey(),
  sohbetId: text("sohbet_id")
    .notNull()
    .references(() => sohbetler.id),
  kurumId: text("kurum_id")
    .notNull()
    .references(() => kurumlar.id),
  kullaniciId: text("kullanici_id")
    .notNull()
    .references(() => kullanicilar.id),
  ad: text("ad").notNull(),
  dosyaAdi: text("dosya_adi").notNull(),
  mimeTur: text("mime_tur").notNull(),
  // Path relative to the data directory; files are served through an
  // authenticated route, never from public/.
  diskYolu: text("disk_yolu").notNull(),
  rawText: text("raw_text"),
  tur: text("tur").notNull(), // gorsel | belge
  zaman: timestamp("zaman", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});
