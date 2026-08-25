import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

/** Loads prompts/{name}.md and fills {placeholder} tokens with `vars`. */
export function loadPrompt(name: string, vars: Record<string, string>): string {
  const raw = readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf-8");
  return raw.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  );
}
