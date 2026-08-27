import { randomUUID } from "node:crypto";
import { sohbetleriListele } from "@/lib/sohbet";
import { SohbetDuzeni } from "@/components/sohbet/sohbet-duzeni";
import { AsistanSohbet } from "@/app/panel/asistan/asistan-sohbet";
import { PublicShell } from "@/components/PublicShell";

export const metadata = {
  title: "Dilekçe & Kurum Danışmanı Asistanı | e-Başvuru",
  description:
    "Kamu kurumları ve belediye birimleri hakkında bilgi edinin, 3071 sayılı Kanuna uygun resmi dilekçe taslağınızı hazırlayın ve düzenleyin.",
};

export default async function VatandasAsistanSayfasi() {
  const sahip = {
    userId: "u_vatandas",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
  };

  const sohbetler = await sohbetleriListele(sahip);
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
