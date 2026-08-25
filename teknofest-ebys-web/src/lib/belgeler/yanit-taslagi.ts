/**
 * The structured shape of a citizen response letter. `konu` and `hitap` are
 * short one-line letterhead fields (subject line, addressee) — genuinely
 * distinct from the body, the way an email's subject/to line is. Everything
 * else (the İlgi reference, the body paragraphs, the closing formula) is
 * one flowing `govdeMetni` the author writes as a single continuous piece,
 * not a set of disconnected boxes.
 */
export interface YanitTaslagi {
  konu: string;
  hitap: string;
  govdeMetni: string;
}

export function bosYanitTaslagi(): YanitTaslagi {
  return { konu: "", hitap: "", govdeMetni: "" };
}

export function yanitTaslagiCoz(ham: string | null): YanitTaslagi | null {
  if (!ham) return null;
  try {
    const o = JSON.parse(ham) as Partial<YanitTaslagi>;
    return {
      konu: o.konu ?? "",
      hitap: o.hitap ?? "",
      govdeMetni: o.govdeMetni ?? "",
    };
  } catch {
    return null;
  }
}
