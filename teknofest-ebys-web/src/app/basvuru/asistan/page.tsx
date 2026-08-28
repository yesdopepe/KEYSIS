import { randomUUID } from "node:crypto";
import { getVatandasSohbetIdleri } from "@/lib/auth/vatandas-session";
import { vatandasSohbetleriListele } from "@/lib/sohbet";
import { SohbetDuzeni } from "@/components/sohbet/sohbet-duzeni";
import { AsistanSohbet } from "@/app/panel/asistan/asistan-sohbet";
import { PublicShell } from "@/components/PublicShell";

export const metadata = {
  title: "Dilekçe & Kurum Danışmanı Asistanı | KEYSİS",
  description:
    "Kamu kurumları ve idari birimler hakkında bilgi edinin, 3071 sayılı Kanuna uygun resmi dilekçe taslağınızı hazırlayın ve düzenleyin.",
};

export default async function VatandasAsistanSayfasi() {
  const vatandasSohbetIdleri = await getVatandasSohbetIdleri();
  const sohbetler = await vatandasSohbetleriListele(vatandasSohbetIdleri);
  const yeniSohbetId = randomUUID();

  return (
    <PublicShell activeHref="/basvuru/asistan">
      <div className="h-[calc(100dvh-4rem)] w-full">
        <SohbetDuzeni
          sohbetler={sohbetler}
          baseHref="/basvuru/asistan"
          baslik="Dilekçe & Kurum Danışmanı Asistanı"
        >
          <AsistanSohbet sohbetId={yeniSohbetId} yeniMi baseHref="/basvuru/asistan" />
        </SohbetDuzeni>
      </div>
    </PublicShell>
  );
}
