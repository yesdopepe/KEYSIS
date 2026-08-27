import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL yok!");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, ssl: "require" });
const SIFRE_HASH = bcrypt.hashSync("vatandas123", 10);

async function run() {
  console.log("Vatandaş kullanıcısı ve kurum doğrulanıyor...");
  try {
    // Check if belediye_ornek exists
    const [kurum] = await sql`SELECT id FROM kurumlar LIMIT 1`;
    const kurumId = kurum?.id || "belediye_ornek";

    const [birim] = await sql`SELECT id FROM birimler WHERE kurum_id = ${kurumId} LIMIT 1`;
    const birimId = birim?.id || `${kurumId}:YZI`;

    await sql`
      INSERT INTO kullanicilar (id, kullanici_adi, sifre_hash, ad_soyad, kurum_id, birim_id, hiyerarsi_seviyesi, unvan, aktif_mi)
      VALUES ('u_vatandas', 'vatandas', ${SIFRE_HASH}, 'Vatandaş', ${kurumId}, ${birimId}, 0, 'Vatandaş', true)
      ON CONFLICT (id) DO UPDATE SET
        hiyerarsi_seviyesi = 0,
        unvan = 'Vatandaş';
    `;
    console.log("u_vatandas kullanıcısı doğrulandı (hiyerarsi_seviyesi: 0).");
  } catch (err) {
    console.error("Hata:", err);
  } finally {
    await sql.end();
  }
}

run();
