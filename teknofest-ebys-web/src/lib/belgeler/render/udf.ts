import "server-only";
import { zipSync, strToU8 } from "fflate";
import { govdeBloklariniAyir, type ResmiBelge } from "../resmi-belge";

/**
 * UDF (UYAP Doküman Formatı) writer — the format Turkish courts and public
 * institutions exchange documents in. A .udf file is a Deflate ZIP holding a
 * single content.xml: all document text lives in one CDATA pool, and the
 * structure elements reference it by CHARACTER offset/length rather than
 * containing the text themselves. That indirection is the whole format, and
 * it is why offsets are computed in one pass here instead of per element.
 *
 * Spec reference: https://github.com/saidsurucu/UDF-Toolkit (Docs.md)
 */

const FONT = "Times New Roman";
const SIYAH = -16777216; // 0xFF000000 as signed int32
const ZWSP = "​"; // empty paragraphs must still occupy one character
const TAB = "\t";

const HIZALAMA = { sol: 0, orta: 1, sag: 2, iki_yana: 3 } as const;
type Hizalama = keyof typeof HIZALAMA;

interface Parca {
  metin: string;
  kalin?: boolean;
  italik?: boolean;
  boyut?: number;
  tab?: boolean;
}

interface UdfParagraf {
  parcalar: Parca[];
  hizalama: Hizalama;
  /** Right tab stop in points, needed for the Sayı … Tarih line. */
  tabDurak?: number;
  soldanGirinti?: number;
  ilkSatirGirintisi?: number;
}

class UdfYazar {
  private paragraflar: UdfParagraf[] = [];

  paragraf(p: UdfParagraf) {
    this.paragraflar.push(p);
    return this;
  }

  duz(metin: string, opts: Omit<UdfParagraf, "parcalar"> & Partial<Parca> = { hizalama: "sol" }) {
    const { hizalama = "sol", tabDurak, soldanGirinti, ilkSatirGirintisi, ...parca } = opts;
    return this.paragraf({
      parcalar: [{ metin, ...parca }],
      hizalama,
      tabDurak,
      soldanGirinti,
      ilkSatirGirintisi,
    });
  }

  bos(sayi = 1) {
    for (let i = 0; i < sayi; i += 1) this.duz("", { hizalama: "sol" });
    return this;
  }

  /**
   * Single pass that both concatenates the text pool and emits elements
   * pointing into it — the two must stay in lockstep or the whole document
   * renders shifted, so they are deliberately not computed separately.
   */
  derle(): string {
    const havuz: string[] = [];
    const elemanlar: string[] = [];
    let offset = 0;

    this.paragraflar.forEach((p, i) => {
      const nitelikler = [
        `Alignment="${HIZALAMA[p.hizalama]}"`,
        p.soldanGirinti ? `LeftIndent="${p.soldanGirinti.toFixed(1)}"` : "",
        p.ilkSatirGirintisi ? `FirstLineIndent="${p.ilkSatirGirintisi.toFixed(1)}"` : "",
        p.tabDurak ? `TabSet="${p.tabDurak.toFixed(1)}:2:0"` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const cocuklar: string[] = [];
      const parcalar = p.parcalar.length > 0 ? p.parcalar : [{ metin: "" }];

      for (const parca of parcalar) {
        const metin = parca.tab ? TAB : parca.metin;
        if (metin.length === 0) continue;
        havuz.push(metin);
        const ortak = `startOffset="${offset}" length="${metin.length}" family="${FONT}" size="${parca.boyut ?? 12}"`;
        if (parca.tab) {
          cocuklar.push(`      <tab ${ortak} />`);
        } else {
          const stil = [
            parca.kalin ? ' bold="true"' : "",
            parca.italik ? ' italic="true"' : "",
          ].join("");
          cocuklar.push(`      <content ${ortak}${stil} foreground="${SIYAH}" />`);
        }
        offset += metin.length;
      }

      if (cocuklar.length === 0) {
        // An empty paragraph still needs one addressable character.
        havuz.push(ZWSP);
        cocuklar.push(
          `      <content startOffset="${offset}" length="1" family="${FONT}" size="12" foreground="${SIYAH}" />`
        );
        offset += 1;
      }

      elemanlar.push(`    <paragraph ${nitelikler}>`, ...cocuklar, `    </paragraph>`);

      // Paragraphs are separated by a newline inside the pool itself.
      if (i < this.paragraflar.length - 1) {
        havuz.push("\n");
        offset += 1;
      }
    });

    const govde = havuz.join("").replace(/]]>/g, "]]&gt;");

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<template format_id="1.8">',
      `<content><![CDATA[${govde}]]></content>`,
      "<properties>",
      '  <pageFormat mediaSizeName="1" leftMargin="70.87" rightMargin="56.69" topMargin="70.87" bottomMargin="70.87" paperOrientation="1" headerFOffset="20.0" footerFOffset="20.0" />',
      "</properties>",
      '<elements resolver="hvl-default">',
      ...elemanlar,
      "</elements>",
      "<styles>",
      '  <style name="default" description="Varsayılan" family="Dialog" size="12" bold="false" italic="false" foreground="-13421773" />',
      `  <style name="hvl-default" family="${FONT}" size="12" description="Gövde" />`,
      "</styles>",
      "</template>",
    ].join("\n");
  }
}

export function udfOlustur(belge: ResmiBelge): Buffer {
  const y = new UdfYazar();

  // A dilekçe has no kurumAdi — it is written by a citizen, not issued by an institution — so the whole T.C. antet and the registry number are omitted rather than printed empty or with a placeholder.
  if (belge.kurumAdi) {
    y.duz("T.C.", { hizalama: "orta" });
    y.duz(belge.kurumAdi, { hizalama: "orta", kalin: true });
    if (belge.birimAdi) y.duz(belge.birimAdi, { hizalama: "orta" });
    y.bos(2);
  }

  y.paragraf({
    hizalama: "sol",
    tabDurak: 467,
    parcalar: belge.sayi
      ? [{ metin: `Sayı : ${belge.sayi}` }, { metin: "", tab: true }, { metin: belge.tarih }]
      : [{ metin: "", tab: true }, { metin: belge.tarih }],
  });
  if (belge.konu) y.duz(`Konu : ${belge.konu}`);
  y.bos(2);

  if (belge.hitap) {
    y.duz(belge.hitap, { hizalama: "orta", kalin: true });
    y.bos(2);
  }

  for (const blok of govdeBloklariniAyir(belge.govdeMetni)) {
    if (blok.tur === "baslik") {
      y.duz(blok.metin.toLocaleUpperCase("tr-TR"), { hizalama: "sol", kalin: true });
    } else if (blok.tur === "liste") {
      for (const oge of blok.ogeler) {
        y.duz(`•  ${oge}`, { hizalama: "sol", soldanGirinti: 28 });
      }
    } else {
      y.duz(blok.metin, { hizalama: "iki_yana", ilkSatirGirintisi: 28 });
    }
  }

  if (belge.imza) {
    y.bos(2);
    y.duz(belge.imza.adSoyad, { hizalama: "sag", kalin: true });
    y.duz(belge.imza.unvan, { hizalama: "sag" });
  }

  if (belge.ekler && belge.ekler.length > 0) {
    y.bos();
    belge.ekler.forEach((e, i) => y.duz(`${i === 0 ? "Ek : " : "     "}${i + 1}- ${e}`));
  }

  if (belge.dagitim && belge.dagitim.length > 0) {
    y.bos();
    belge.dagitim.forEach((d, i) => y.duz(`${i === 0 ? "Dağıtım : " : "          "}${d}`));
  }

  if (belge.kaynaklar && belge.kaynaklar.length > 0) {
    y.bos(2);
    y.duz("DAYANAK / KAYNAKLAR", { hizalama: "sol", kalin: true, boyut: 9 });
    for (const k of belge.kaynaklar) {
      y.duz(`• ${k.referans} — ${k.aciklama}`, { hizalama: "sol", boyut: 9 });
    }
  }

  const zip = zipSync(
    { "content.xml": strToU8(y.derle()) },
    { level: 6 }
  );
  return Buffer.from(zip);
}
