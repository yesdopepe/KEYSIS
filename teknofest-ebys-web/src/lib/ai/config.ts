/**
 * Central model configuration. No agent code should hardcode a model ID —
 * every call goes through getAgentModel() in client.ts, which reads from
 * here. Model choice per agent is env-driven (see .env.example) so the
 * model can be swapped without touching code; the defaults below are only
 * used when the corresponding env var is unset.
 */
export const MODEL_ENV_VARS = {
  router_agent: "ROUTER_AGENT_MODEL",
  reader_agent: "READER_AGENT_MODEL",
  writer_agent: "WRITER_AGENT_MODEL",
  eksik_bilgi_agent: "EKSIK_BILGI_AGENT_MODEL",
  belge_yazar_agent: "BELGE_YAZAR_AGENT_MODEL",
  asistan_agent: "ASISTAN_AGENT_MODEL",
  asistan_gorsel_agent: "ASISTAN_GORSEL_AGENT_MODEL",
  sohbet_baslik_agent: "SOHBET_BASLIK_AGENT_MODEL",
  ek_analiz_agent: "EK_ANALIZ_AGENT_MODEL",
  vatandas_asistan_agent: "VATANDAS_ASISTAN_AGENT_MODEL",
} as const;

/**
 * EVREN model ids (see .env.example): `router` (lightweight classification),
 * `llm-fast` (terminology, document analysis), `llm-large` (long reasoning
 * chains, multimodal). `llm-large` is required for asistan_gorsel_agent —
 * EVREN's dedicated `vlm` model is video-only and rejects images outright.
 */
export const MODEL_DEFAULTS = {
  router_agent: "router",
  reader_agent: "llm-fast",
  writer_agent: "llm-large",
  eksik_bilgi_agent: "llm-fast",
  belge_yazar_agent: "llm-large",
  // The assistant streams and calls tools, so it needs a model with solid
  // tool-calling support rather than the cheapest one.
  asistan_agent: "llm-large",
  // Used only when a conversation contains an image: must handle vision AND
  // tool calling, since the assistant still needs its search tools.
  asistan_gorsel_agent: "llm-large",
  sohbet_baslik_agent: "llm-fast",
  ek_analiz_agent: "llm-fast",
  vatandas_asistan_agent: "llm-large",
} as const;

export const AGENT_TEMPERATURES = {
  router_agent: 0.1,
  reader_agent: 0.2,
  writer_agent: 0.4,
  eksik_bilgi_agent: 0.1,
  belge_yazar_agent: 0.3,
  asistan_agent: 0.3,
  asistan_gorsel_agent: 0.3,
  sohbet_baslik_agent: 0.2,
  ek_analiz_agent: 0.2,
  vatandas_asistan_agent: 0.3,
} as const;

/**
 * Generous budgets so structured output never gets truncated. EVREN's
 * enable_thinking mode is off by default here (never set by getAgentModel) —
 * per the provider's own docs it multiplies token consumption 9-17x for
 * little accuracy gain, so it's deliberately not enabled.
 */
export const AGENT_MAX_OUTPUT_TOKENS = {
  router_agent: 4096,
  reader_agent: 8192,
  writer_agent: 8192,
  eksik_bilgi_agent: 2048,
  belge_yazar_agent: 8192,
  asistan_agent: 8192,
  asistan_gorsel_agent: 8192,
  sohbet_baslik_agent: 128,
  ek_analiz_agent: 4096,
  vatandas_asistan_agent: 8192,
} as const;

export type AgentName = keyof typeof MODEL_DEFAULTS;
