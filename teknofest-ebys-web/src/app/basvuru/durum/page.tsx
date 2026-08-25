import { Suspense } from "react";
import DurumIcerik from "./durum-icerik";

export default function DurumSayfasi() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <DurumIcerik />
    </Suspense>
  );
}
