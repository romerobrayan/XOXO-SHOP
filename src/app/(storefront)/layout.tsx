import { AnnouncementBar } from "@/components/site/AnnouncementBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AgeGate } from "@/features/age-gate/components/AgeGate";
import { CartHydration } from "@/features/cart/components/CartHydration";

// Storefront shell per the handoff: announcement bar, sticky header, footer,
// and the age gate. Pages own their containers — home needs full-bleed bands
// (héroe, pilares), so there is no global max-width wrapper here.
export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AgeGate />
      <CartHydration />
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
