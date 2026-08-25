import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { govdeBloklariniAyir, type ResmiBelge } from "../resmi-belge";

/**
 * Tinos is metric-compatible with Times New Roman and ships full Turkish
 * coverage. It has to be embedded: PDF's built-in WinAnsi fonts have no
 * ğ/ş/İ/ı glyphs, so an official Turkish letter would render corrupted.
 * Registered from disk rather than a CDN so rendering never depends on a
 * network fetch at request time.
 */
const FONT_DIZINI = path.join(process.cwd(), "assets", "fonts");
let fontKayitli = false;

function fontlariKaydet() {
  if (fontKayitli) return;
  Font.register({
    family: "Tinos",
    fonts: [
      { src: path.join(FONT_DIZINI, "Tinos-Regular.ttf") },
      { src: path.join(FONT_DIZINI, "Tinos-Bold.ttf"), fontWeight: "bold" },
      { src: path.join(FONT_DIZINI, "Tinos-Italic.ttf"), fontStyle: "italic" },
      { src: path.join(FONT_DIZINI, "Tinos-BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  // Turkish has no hyphenation dictionary here; splitting words mid-syllable
  // looks wrong on an official letter, so disable it outright.
  Font.registerHyphenationCallback((kelime) => [kelime]);
  fontKayitli = true;
}

const s = StyleSheet.create({
  sayfa: {
    fontFamily: "Tinos",
    fontSize: 12,
    paddingTop: 70,
    paddingBottom: 70,
    paddingLeft: 71,
    paddingRight: 57,
    lineHeight: 1.4,
    color: "#000000",
  },
  ortali: { textAlign: "center" },
  kurum: { textAlign: "center", fontWeight: "bold" },
  ustBilgiSatiri: { flexDirection: "row", justifyContent: "space-between" },
  etiketSatiri: { flexDirection: "row" },
  etiket: { width: 52 },
  hitap: { textAlign: "center", fontWeight: "bold", marginTop: 18, marginBottom: 18 },
  bolumBasligi: { fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  govdeParagrafi: { textAlign: "justify", marginBottom: 8, textIndent: 28 },
  listeOgesi: { flexDirection: "row", marginBottom: 3, paddingLeft: 28 },
  listeIsareti: { width: 14 },
  saga: { textAlign: "right" },
  imzaBlogu: { marginTop: 28, alignItems: "flex-end" },
  kaynakBasligi: { fontSize: 9, fontWeight: "bold", marginTop: 26, marginBottom: 3 },
  kaynak: { fontSize: 9, marginBottom: 2 },
  sayfaNo: { position: "absolute", bottom: 32, left: 0, right: 0, textAlign: "center", fontSize: 9 },
});

function ResmiBelgeSayfasi({ belge }: { belge: ResmiBelge }) {
  return (
    <Document title={belge.konu ?? belge.belgeTuruAdi} author={belge.kurumAdi}>
      <Page size="A4" style={s.sayfa}>
        <Text style={s.ortali}>T.C.</Text>
        <Text style={s.kurum}>{belge.kurumAdi}</Text>
        {belge.birimAdi ? <Text style={s.ortali}>{belge.birimAdi}</Text> : null}

        <View style={{ marginTop: 22 }}>
          <View style={s.ustBilgiSatiri}>
            <Text>Sayı : {belge.sayi ?? ""}</Text>
            <Text>{belge.tarih}</Text>
          </View>
          {belge.konu ? (
            <View style={s.etiketSatiri}>
              <Text style={s.etiket}>Konu</Text>
              <Text>: {belge.konu}</Text>
            </View>
          ) : null}
        </View>

        {belge.hitap ? <Text style={s.hitap}>{belge.hitap}</Text> : <View style={{ height: 18 }} />}

        {govdeBloklariniAyir(belge.govdeMetni).map((blok, i) => {
          if (blok.tur === "baslik") {
            return (
              <Text key={i} style={s.bolumBasligi}>
                {blok.metin.toLocaleUpperCase("tr-TR")}
              </Text>
            );
          }
          if (blok.tur === "liste") {
            return (
              <View key={i} style={{ marginBottom: 5 }}>
                {blok.ogeler.map((oge, j) => (
                  <View key={j} style={s.listeOgesi}>
                    <Text style={s.listeIsareti}>•</Text>
                    <Text style={{ flex: 1 }}>{oge}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text key={i} style={s.govdeParagrafi}>
              {blok.metin}
            </Text>
          );
        })}

        {belge.imza ? (
          <View style={s.imzaBlogu}>
            <Text style={{ fontWeight: "bold" }}>{belge.imza.adSoyad}</Text>
            <Text>{belge.imza.unvan}</Text>
          </View>
        ) : null}

        {belge.ekler && belge.ekler.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            {belge.ekler.map((e, i) => (
              <View key={i} style={s.etiketSatiri}>
                <Text style={s.etiket}>{i === 0 ? "Ek" : ""}</Text>
                <Text>
                  {i === 0 ? ": " : "  "}
                  {i + 1}- {e}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {belge.dagitim && belge.dagitim.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {belge.dagitim.map((d, i) => (
              <View key={i} style={s.etiketSatiri}>
                <Text style={s.etiket}>{i === 0 ? "Dağıtım" : ""}</Text>
                <Text>
                  {i === 0 ? ": " : "  "}
                  {d}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {belge.kaynaklar && belge.kaynaklar.length > 0 ? (
          <View>
            <Text style={s.kaynakBasligi}>DAYANAK / KAYNAKLAR</Text>
            {belge.kaynaklar.map((k, i) => (
              <Text key={i} style={s.kaynak}>
                • {k.referans} — {k.aciklama}
              </Text>
            ))}
          </View>
        ) : null}

        <Text
          style={s.sayfaNo}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function pdfOlustur(belge: ResmiBelge): Promise<Buffer> {
  fontlariKaydet();
  return renderToBuffer(<ResmiBelgeSayfasi belge={belge} />);
}
