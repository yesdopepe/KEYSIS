import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  MODEL_ENV_VARS,
  MODEL_DEFAULTS,
  AGENT_TEMPERATURES,
  AGENT_MAX_OUTPUT_TOKENS,
  type AgentName,
} from "./config";

/**
 * EVREN inference service (OpenAI-compatible) — see
 * https://evren-teknofest.ssyz.org.tr/hizli-baslangic. Serves both chat
 * models and the embedding model off the same base URL, so this one
 * provider instance backs getAgentModel() below and getEmbeddingModel() in
 * lib/vektor/qdrant.ts.
 */
const evren = createOpenAICompatible({
  name: "evren",
  baseURL: process.env.EVREN_BASE_URL ?? "https://evren-llmapi.ssyz.org.tr/v1",
  apiKey: process.env.EVREN_API_KEY,
  // Confirmed supported: response_format json_schema with strict: true.
  supportsStructuredOutputs: true,
});

/**
 * Single place every agent goes through to get a model handle + its
 * configured temperature/output budget. The actual model per agent is
 * env-driven — see .env.example — so it can be swapped without a code
 * change.
 */
export function getAgentModel(agentName: AgentName) {
  const envVar = MODEL_ENV_VARS[agentName];
  const modelId = process.env[envVar] || MODEL_DEFAULTS[agentName];
  return {
    model: evren(modelId),
    temperature: AGENT_TEMPERATURES[agentName],
    maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS[agentName],
  };
}

/** Dense embedding model, shared by every vector-search caller in lib/vektor/qdrant.ts. */
export function getEmbeddingModel() {
  const modelId = process.env.EMBEDDING_MODEL || "bge-m3-embed";
  return evren.embeddingModel(modelId);
}
