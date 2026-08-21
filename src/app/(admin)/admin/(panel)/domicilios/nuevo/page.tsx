import type { Metadata } from "next";
import Link from "next/link";

import { ZoneForm } from "@/features/shipping/components/ZoneForm";

export const metadata: Metadata = {
  title: "Nueva zona",
  robots: { index: false, follow: false },
};

export default function NuevaZonaPage() {
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
          Nueva zona
        </h1>
      </div>
      <ZoneForm />
    </section>
  );
}
