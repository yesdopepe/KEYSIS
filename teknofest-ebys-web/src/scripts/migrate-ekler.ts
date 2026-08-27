import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL yok!");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, ssl: "require" });

async function run() {
  console.log("Tablo ve sütun güncellemeleri uygulanıyor...");
  try {
    await sql`
      ALTER TABLE evraklar ADD COLUMN IF NOT EXISTS ek_analizi text;
    `;
    console.log("evraklar.ek_analizi eklendi/doğrulandı.");

    await sql`
      CREATE TABLE IF NOT EXISTS evrak_ekleri (
        id text PRIMARY KEY,
        evrak_id text NOT NULL REFERENCES evraklar(id) ON DELETE CASCADE,
        ad text NOT NULL,
        dosya_adi text NOT NULL,
        mime_tur text NOT NULL,
        boyut integer NOT NULL DEFAULT 0,
        disk_yolu text NOT NULL,
        raw_text text,
        tur text NOT NULL DEFAULT 'belge',
        analiz_ozeti text,
        uygunluk_durumu text DEFAULT 'uyumlu',
        uygunluk_notu text,
        zaman timestamp with time zone NOT NULL DEFAULT now()
      );
    `;
    console.log("evrak_ekleri tablosu oluşturuldu/doğrulandı.");

    console.log("Tüm migration işlemleri başarıyla tamamlandı!");
  } catch (err) {
    console.error("Migration hatası:", err);
  } finally {
    await sql.end();
  }
}

run();
