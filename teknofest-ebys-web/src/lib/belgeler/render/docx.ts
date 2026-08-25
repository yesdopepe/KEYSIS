import "server-only";
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
} from "docx";
import { govdeBloklariniAyir, type ResmiBelge } from "../resmi-belge";

const FONT = "Times New Roman";
const PT = (n: number) => n * 2; // docx half-points

function metin(text: string, opts: { bold?: boolean; size?: number; italic?: boolean } = {}) {
  return new TextRun({
    text,
    font: FONT,
    bold: opts.bold,
    italics: opts.italic,
    size: PT(opts.size ?? 12),
  });
}

function ortali(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [metin(text, opts)],
  });
}

function bos(sayi = 1) {
  return Array.from({ length: sayi }, () => new Paragraph({ children: [] }));
}

/**
 * Renders the canonical model as a .docx buffer. The font is declared as
 * Times New Roman rather than embedded — Word resolves it locally, and the
 * PDF renderer uses metric-compatible Tinos so both outputs line up.
 */
export async function docxOlustur(belge: ResmiBelge): Promise<Buffer> {
  const govde: Paragraph[] = [];

  govde.push(ortali("T.C."), ortali(belge.kurumAdi, { bold: true }));
  if (belge.birimAdi) govde.push(ortali(belge.birimAdi));
  govde.push(...bos(2));

  govde.push(
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: convertMillimetersToTwip(165) }],
      children: [metin(`Sayı\t: ${belge.sayi ?? ""}`), metin(`\t${belge.tarih}`)],
    })
  );
  if (belge.konu) {
    govde.push(new Paragraph({ children: [metin(`Konu\t: ${belge.konu}`)] }));
  }
  govde.push(...bos(2));

  if (belge.hitap) {
    govde.push(ortali(belge.hitap, { bold: true }), ...bos(2));
  }

  for (const blok of govdeBloklariniAyir(belge.govdeMetni)) {
    if (blok.tur === "baslik") {
      govde.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [metin(blok.metin.toLocaleUpperCase("tr-TR"), { bold: true })],
        })
      );
    } else if (blok.tur === "liste") {
      for (const oge of blok.ogeler) {
        govde.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [metin(oge)],
          })
        );
      }
    } else {
      govde.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: convertMillimetersToTwip(10) },
          spacing: { after: 120, line: 276 },
          children: [metin(blok.metin)],
        })
      );
    }
  }

  if (belge.imza) {
    govde.push(
      ...bos(2),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [metin(belge.imza.adSoyad, { bold: true })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [metin(belge.imza.unvan)] })
    );
  }

  if (belge.ekler && belge.ekler.length > 0) {
    govde.push(...bos(1));
    belge.ekler.forEach((e, i) => {
      govde.push(new Paragraph({ children: [metin(`${i === 0 ? "Ek\t: " : "\t  "}${i + 1}- ${e}`)] }));
    });
  }

  if (belge.dagitim && belge.dagitim.length > 0) {
    govde.push(...bos(1));
    belge.dagitim.forEach((d, i) => {
      govde.push(new Paragraph({ children: [metin(`${i === 0 ? "Dağıtım\t: " : "\t  "}${d}`)] }));
    });
  }

  if (belge.kaynaklar && belge.kaynaklar.length > 0) {
    govde.push(
      ...bos(2),
      new Paragraph({ children: [metin("DAYANAK / KAYNAKLAR", { bold: true, size: 10 })] })
    );
    for (const k of belge.kaynaklar) {
      govde.push(
        new Paragraph({
          children: [metin(`• ${k.referans} — ${k.aciklama}`, { size: 10 })],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
            },
          },
        },
        children: govde,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
