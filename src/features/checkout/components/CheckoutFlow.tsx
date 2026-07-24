"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Price } from "@/features/catalog/components/Price";
import {
  SHIPPING_CENTS,
  subtotalCents,
  useCart,
  type CartItem,
} from "@/features/cart/store";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

// Checkout en 3 pasos per handoff §4 — Bolsa, Datos, Pago — con confirmación
// en la misma vista (el stepper desaparece al confirmar). Fase 0: el pedido
// no persiste todavía; al confirmar se congela un snapshot para el resumen y
// la bolsa se vacía. Colombian invoicing fields (department, documentType,
// documentId) join in Sprint 3 when real orders are created.

const PASOS = ["Bolsa", "Datos", "Pago"] as const;

// Medellín primero: es la plaza de contra entrega.
const CIUDADES = ["Medellín", "Bogotá", "Cali", "Barranquilla", "Otra ciudad"];

type Paso = 1 | 2 | 3;
type MetodoPago = "contraentrega" | "online";

type DatosEntrega = {
  nombre: string;
  celular: string;
  ciudad: string;
  direccion: string;
  notas: string;
};

const labelClass = "mb-2 block text-sm font-medium text-cuerpo";

function Stepper({ actual }: { actual: Paso }) {
  return (
    <ol
      aria-label="Pasos del checkout"
      className="mb-10 flex items-center justify-center gap-4 md:gap-6"
    >
      {PASOS.map((nombre, i) => {
        const num = (i + 1) as Paso;
        const done = num <= actual;
        return (
          <li key={nombre} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-[30px] items-center justify-center rounded-full text-[13px] font-semibold",
                done ? "bg-vino text-marfil" : "bg-arena text-tenue",
              )}
            >
              {num}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                done ? "text-tinta" : "text-tenue",
              )}
              aria-current={num === actual ? "step" : undefined}
            >
              {nombre}
            </span>
            {i < PASOS.length - 1 && (
              <span
                aria-hidden="true"
                className="ml-2.5 h-px w-6 bg-linea md:w-10"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ItemCard({ item }: { item: CartItem }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const stepperButton =
    "flex h-9 w-9 items-center justify-center text-base text-cuerpo transition-colors hover:text-vino disabled:pointer-events-none disabled:opacity-45";
  return (
    <div className="flex gap-4 rounded-md border border-linea bg-crema p-4">
      <div
        aria-hidden="true"
        className="stripes-placeholder flex h-[110px] w-[88px] shrink-0 items-center justify-center rounded-sm"
      >
        <span className="font-mono text-[10px] text-tenue">foto</span>
      </div>
      <div className="min-w-0 flex-1">
        {item.kicker && <p className="kicker">{item.kicker}</p>}
        <p className="mt-1 font-display text-lg text-tinta">
          <Link href={`/tienda/${item.slug}`} className="hover:text-vino">
            {item.name}
          </Link>
        </p>
        {item.variantLabel && (
          <p className="text-sm text-suave">{item.variantLabel}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-sm border border-linea">
              <button
                type="button"
                className={stepperButton}
                disabled={item.qty <= 1}
                onClick={() => setQty(item.variantId, item.qty - 1)}
              >
                <span aria-hidden="true">−</span>
                <span className="sr-only">Reducir cantidad de {item.name}</span>
              </button>
              <span
                aria-live="polite"
                className="tabular min-w-7 text-center text-sm font-semibold text-tinta"
              >
                {item.qty}
              </span>
              <button
                type="button"
                className={stepperButton}
                onClick={() => setQty(item.variantId, item.qty + 1)}
              >
                <span aria-hidden="true">+</span>
                <span className="sr-only">
                  Aumentar cantidad de {item.name}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(item.variantId)}
              className="text-sm text-suave transition-colors hover:text-error"
            >
              Quitar
            </button>
          </div>
          <Price cents={item.priceCents * item.qty} />
        </div>
      </div>
    </div>
  );
}

export function CheckoutFlow() {
  const cartItems = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [paso, setPaso] = useState<Paso>(1);
  const [datos, setDatos] = useState<DatosEntrega>({
    nombre: "",
    celular: "",
    ciudad: CIUDADES[0],
    direccion: "",
    notas: "",
  });
  const [metodo, setMetodo] = useState<MetodoPago>("contraentrega");
  // Frozen at confirmation so the summary survives clearing the bag.
  const [confirmado, setConfirmado] = useState<CartItem[] | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso, confirmado]);

  const items = confirmado ?? cartItems;
  const vacia = items.length === 0;
  const subtotal = subtotalCents(items);
  const total = subtotal + (vacia ? 0 : SHIPPING_CENTS);

  function confirmar() {
    setConfirmado(cartItems);
    clear();
  }

  function set<K extends keyof DatosEntrega>(key: K, value: string) {
    setDatos((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      {!confirmado && <Stepper actual={paso} />}

      <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
        <div>
          {confirmado ? (
            <div className="py-6 text-center">
              <div
                aria-hidden="true"
                className="mx-auto flex size-[88px] items-center justify-center rounded-full border-2 border-exito font-display text-3xl text-exito"
              >
                ✓
              </div>
              <h1 className="mt-6 text-2xl">Pedido confirmado</h1>
              <p className="mx-auto mt-3 max-w-[44ch] font-light">
                Te escribimos por WhatsApp para coordinar la entrega. Recuerda:
                caja neutra, remitente genérico —{" "}
                <strong className="font-medium">tu secreto está a salvo</strong>
                .
              </p>
              <Button variant="outline" asChild className="mt-6">
                <Link href="/">Volver a la tienda</Link>
              </Button>
            </div>
          ) : paso === 1 ? (
            <div>
              <h1 className="mb-6 text-2xl">Tu bolsa</h1>
              {vacia ? (
                <div className="flex flex-col items-start gap-4 py-4">
                  <p className="font-light">
                    Tu bolsa está vacía. Lo que agregues queda solo en este
                    navegador.
                  </p>
                  <Button asChild>
                    <Link href="/tienda">Ver colección</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-4">
                    {items.map((item) => (
                      <ItemCard key={item.variantId} item={item} />
                    ))}
                  </div>
                  <Button className="mt-6 w-full" onClick={() => setPaso(2)}>
                    Continuar con mis datos
                  </Button>
                  <Button variant="ghost" asChild className="mt-2 w-full">
                    <Link href="/tienda">← Seguir comprando</Link>
                  </Button>
                </>
              )}
            </div>
          ) : paso === 2 ? (
            <div>
              <h1 className="mb-6 text-2xl">Datos de entrega</h1>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPaso(3);
                }}
                className="grid gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Nombre</span>
                    <Input
                      required
                      autoComplete="name"
                      placeholder="Tu nombre"
                      value={datos.nombre}
                      onChange={(e) => set("nombre", e.target.value)}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Celular (WhatsApp)</span>
                    <Input
                      required
                      type="tel"
                      autoComplete="tel"
                      placeholder="300 000 0000"
                      value={datos.celular}
                      onChange={(e) => set("celular", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  <span className={labelClass}>Ciudad</span>
                  <Select
                    value={datos.ciudad}
                    onChange={(e) => set("ciudad", e.target.value)}
                  >
                    {CIUDADES.map((ciudad) => (
                      <option key={ciudad} value={ciudad}>
                        {ciudad}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  <span className={labelClass}>Dirección</span>
                  <Input
                    required
                    autoComplete="street-address"
                    placeholder="Calle, número, apto"
                    value={datos.direccion}
                    onChange={(e) => set("direccion", e.target.value)}
                  />
                </label>
                <label>
                  <span className={labelClass}>
                    Notas para el mensajero (opcional)
                  </span>
                  <Input
                    placeholder="Ej: entregar en portería"
                    value={datos.notas}
                    onChange={(e) => set("notas", e.target.value)}
                  />
                </label>
                <div className="rounded-md bg-arena p-4 text-sm leading-relaxed">
                  Tu paquete llega en caja neutra con remitente genérico. En la
                  guía de envío solo aparece &ldquo;artículos
                  personales&rdquo;.
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPaso(1)}
                  >
                    ← Volver
                  </Button>
                  <Button type="submit" className="flex-1">
                    Continuar al pago
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h1 className="mb-6 text-2xl">Método de pago</h1>
              <div role="radiogroup" aria-label="Método de pago" className="grid gap-3">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md bg-crema p-4",
                    metodo === "contraentrega"
                      ? "border-2 border-vino"
                      : "border border-linea",
                  )}
                >
                  <input
                    type="radio"
                    name="pago"
                    className="mt-1 accent-vino"
                    checked={metodo === "contraentrega"}
                    onChange={() => setMetodo("contraentrega")}
                  />
                  <span>
                    <span className="font-semibold text-tinta">
                      Contra entrega
                    </span>{" "}
                    <Badge variant="oro" className="ml-1">
                      Medellín
                    </Badge>
                    <span className="mt-1 block text-sm font-light text-suave">
                      Pagas en efectivo cuando recibes. Revisas la caja primero.
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md bg-crema p-4",
                    metodo === "online"
                      ? "border-2 border-vino"
                      : "border border-linea",
                  )}
                >
                  <input
                    type="radio"
                    name="pago"
                    className="mt-1 accent-vino"
                    checked={metodo === "online"}
                    onChange={() => setMetodo("online")}
                  />
                  <span>
                    <span className="font-semibold text-tinta">
                      Transferencia o tarjeta
                    </span>
                    <span className="mt-1 block text-sm font-light text-suave">
                      Nequi, Bancolombia o pago con tarjeta. El cobro aparece
                      como &ldquo;SECRETO BTQ&rdquo;.
                    </span>
                  </span>
                </label>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="ghost" onClick={() => setPaso(2)}>
                  ← Volver
                </Button>
                <Button className="flex-1" onClick={confirmar}>
                  Confirmar pedido
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        <aside className="rounded-md border border-linea bg-crema p-6 lg:sticky lg:top-6">
          <p className="kicker mb-4">Resumen</p>
          {vacia ? (
            <p className="text-sm text-suave">Tu bolsa está vacía.</p>
          ) : (
            <div className="grid gap-2.5 text-sm">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex justify-between gap-3"
                >
                  <span>
                    {item.name}
                    {item.qty > 1 && ` × ${item.qty}`}
                  </span>
                  <span className="tabular shrink-0">
                    {formatCOP(item.priceCents * item.qty)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between gap-3 text-suave">
                <span>Envío discreto</span>
                <span className="tabular shrink-0">
                  {formatCOP(SHIPPING_CENTS)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-linea pt-3">
                <span className="font-medium text-tinta">Total</span>
                <Price cents={total} size="lg" />
              </div>
            </div>
          )}
          <div className="mt-4 grid justify-items-start gap-2">
            <Badge>Empaque neutro</Badge>
            <Badge>Remitente genérico</Badge>
            <Badge variant="exito">Garantía 6 meses</Badge>
          </div>
          <WhatsAppCta
            message="Hola, necesito ayuda con mi pedido"
            className="mt-4 w-full"
          >
            ¿Ayuda? Escríbenos
          </WhatsAppCta>
        </aside>
      </div>
    </div>
  );
}
