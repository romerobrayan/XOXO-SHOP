import { Mail } from "lucide-react";
import Link from "next/link";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Button } from "@/components/ui/button";
import { CategoryTile } from "@/features/catalog/components/CategoryTile";
import { HomeShowcase } from "@/features/catalog/components/HomeShowcase";
import { getCategories, getProducts } from "@/features/catalog/queries";
import { HeroShowcase } from "@/features/home/components/HeroShowcase";
import { NewsletterForm } from "@/features/home/components/NewsletterForm";
import { heroSlides } from "@/features/home/heroSlides";

// Home per the handoff: héroe con el slogan, categorías con el divisor de
// marca, "Top ventas" con modal de producto, pilares, asesoría/newsletter.
// El héroe es la única zona con degradado; todo lo demás son bandas planas.

// Without this the page is prerendered at build time and "Top ventas" serves a
// frozen snapshot: a price changed in the database shows on /tienda but not
// here until the next deploy. Re-render at most every 5 minutes — not
// force-dynamic, which would make the most visited page pay a database round
// trip on every visit.
export const revalidate = 300;

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  const topVentas = products
    .filter((p) => p.availability.state !== "out")
    .slice(0, 4);

  // One real product photo per family for the hero escaparate; [] while no
  // photography exists (fixtures / pre-import) keeps the approved placeholder.
  const slides = heroSlides(products, categories);

  return (
    <div>
      {/* Héroe */}
      <section className="border-b border-linea bg-[linear-gradient(170deg,var(--color-crema)_0%,var(--color-arena)_100%)]">
        <div className="mx-auto grid w-full max-w-content items-center gap-10 px-4 py-14 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="kicker hero-enter">Boutique Erótica · antes XOXO</p>
            <h1 className="hero-enter mt-4 text-[clamp(40px,7vw,64px)] leading-[1.12] [animation-delay:60ms]">
              El placer es tuyo.
              <br />
              El secreto, nuestro.
            </h1>
            <p className="hero-enter mt-4 max-w-[46ch] text-lg font-light [animation-delay:120ms]">
              Productos curados para tu intimidad, con asesoría honesta y
              empaque neutro del clic a la puerta.
            </p>
            <div className="hero-enter mt-8 flex flex-wrap items-center gap-4 [animation-delay:180ms]">
              <Button asChild>
                <Link href="#catalogo">Ver colección</Link>
              </Button>
              <WhatsAppCta message="Hola, quiero una asesoría">
                Asesoría privada por WhatsApp
              </WhatsAppCta>
            </div>
          </div>
          {slides.length > 0 ? (
            <HeroShowcase
              slides={slides}
              className="hero-enter mx-auto [animation-delay:240ms] lg:mx-0 lg:justify-self-end"
            />
          ) : (
            <ProductImagePlaceholder
              name="Foto editorial · lencería"
              className="hidden w-full max-w-[368px] justify-self-end lg:flex"
            />
          )}
        </div>
      </section>

      {/* Categorías */}
      <section className="mx-auto w-full max-w-content px-4 pt-16 pb-6 md:px-6">
        <h2 className="sr-only">Categorías</h2>
        <div className="divisor">
          <span className="kicker whitespace-nowrap">
            Explora por categoría
          </span>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 md:gap-4">
          {categories.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      </section>

      {/* Top ventas */}
      <section
        id="catalogo"
        className="mx-auto w-full max-w-content px-4 pt-10 pb-16 md:px-6"
      >
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl">Top ventas</h2>
          <Link
            href="/tienda"
            className="text-sm font-medium text-vino hover:text-cobre"
          >
            Ver todo →
          </Link>
        </div>
        <HomeShowcase products={topVentas} />
      </section>

      {/* Pilares */}
      <section className="border-y border-linea bg-crema">
        <h2 className="sr-only">Nuestra promesa</h2>
        <div className="mx-auto grid w-full max-w-content gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
          <div>
            <h3 className="text-xl">Confianza primero</h3>
            <p className="mt-2 font-light">
              Pagos seguros, contra entrega y garantía real en cada pedido.
            </p>
          </div>
          <div>
            <h3 className="text-xl">Experiencia de regalo</h3>
            <p className="mt-2 font-light">
              Neutro por fuera, hermoso por dentro. Nadie sabrá qué llegó en la
              caja.
            </p>
          </div>
          <div>
            <h3 className="text-xl">Para todos</h3>
            <p className="mt-2 font-light">
              Mujeres, hombres, parejas y comunidad LGBTQ+, sin juzgar.
            </p>
          </div>
        </div>
      </section>

      {/* Asesoría / newsletter */}
      <section
        id="asesoria"
        className="mx-auto w-full max-w-[720px] px-4 py-16 text-center md:px-6"
      >
        <Mail aria-hidden="true" strokeWidth={1.5} className="mx-auto size-5 text-vino" />
        <h2 className="mt-4 text-2xl">¿No sabes por dónde empezar?</h2>
        <p className="mx-auto mt-3 mb-8 font-light">
          Déjanos tu correo y recibe la guía para principiantes, o escríbenos
          directo: la asesoría es privada y sin compromiso.
        </p>
        <NewsletterForm />
      </section>
    </div>
  );
}
