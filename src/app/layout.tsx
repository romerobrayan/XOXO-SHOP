import type { Metadata, Viewport } from "next";
import { Archivo, Marcellus } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

// Font Awesome injects its CSS at runtime by default; with RSC that lands
// after first paint and the icons flash full-width. Ship the stylesheet
// statically instead.
config.autoAddCss = false;

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin", "latin-ext"],
  weight: "400",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
});

// viewportFit cover so env(safe-area-inset-bottom) stays available on iPhones.
export const viewport: Viewport = {
  themeColor: "#5C1A2E",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "SECRETO · Boutique Erótica",
    template: "%s · SECRETO",
  },
  description:
    "Boutique erótica con envíos discretos en toda Colombia y contra entrega en Medellín. El placer es tuyo. El secreto, nuestro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      className={`${marcellus.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
