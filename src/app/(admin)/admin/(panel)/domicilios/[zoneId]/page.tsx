import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ZoneForm } from "@/features/shipping/components/ZoneForm";
import { getShippingZone } from "@/features/shipping/queries";

export const metadata: Metadata = {
  title: "Zona de domicilio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ZonaPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const zone = await getShippingZone(zoneId);
  if (!zone) notFound();

  return (
    <section className="grid max-w-2xl gap-6">
      <div>
        <Link
          href="/admin/domicilios"
          className="text-[13px] text-suave hover:text-vino"
        >
          ← Domicilios
        </Link>
        <h1 className="mt-2 font-[family-name:--font-display] text-[32px]">
          {zone.name}
        </h1>
      </div>
      <ZoneForm zone={zone} />
    </section>
  );
}
