"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
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
import { createOrder, type LineConflict } from "@/features/checkout/actions";
import { DEPARTAMENTOS } from "@/features/checkout/schemas";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

// Checkout en 3 pasos per handoff §4 — Bolsa, Datos, Pago — con confirmación
// en la misma vista (el stepper desaparece al confirmar). Bloque C: confirmar
// llama al Server Action createOrder, que re-lee precios de la base, escribe
// Order + OrderItem con snapshots y reserva stock. La bolsa se vacía solo
// cuando el servidor confirma.

const PASOS = ["Bolsa", "Datos", "Pago"] as const;

const DOCUMENTOS = [
  ["CC", "Cédula (CC)"],
  ["CE", "Cédula de extranjería (CE)"],
  ["NIT", "NIT"],
  ["PP", "Pasaporte (PP)"],
] as const;

type Paso = 1 | 2 | 3;
type MetodoPago = "contraentrega" | "online";

type DatosEntrega = {
  nombre: string;
  celular: string;
  email: string;
  documentType: (typeof DOCUMENTOS)[number][0];
  documentId: string;
  department: (typeof DEPARTAMENTOS)[number];
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

// Per-line stale-bag conflicts from the action, each with the one gesture
// that resolves it: accept the new price, or drop the line.
function ConflictPanel({
  conflictos,
  itemName,
  onResolve,
}: {
  conflictos: LineConflict[];
  itemName: (variantId: string) => string | null;
  onResolve: (conflict: LineConflict) => void;
}) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-md border border-error bg-crema p-4"
    >
      <p className="text-sm font-medium text-error">
        Tu bolsa cambió mientras comprabas:
      </p>
      <ul className="mt-3 grid gap-3">
        {conflictos.map((c) => {
          const name = c.productName ?? itemName(c.variantId) ?? "Un producto";
          return (
            <li
              key={c.variantId}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {c.reason === "PRICE_CHANGED" &&
                c.currentPriceCents !== undefined ? (
                  <>
                    {name} ahora cuesta{" "}
                    <strong className="font-semibold">
                      {formatCOP(c.currentPriceCents)}
                    </strong>
                  </>
                ) : c.reason === "OUT_OF_STOCK" ? (
                  `${name} se agotó`
                ) : (
                  `${name} ya no está disponible`
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResolve(c)}
              >
                {c.reason === "PRICE_CHANGED"
                  ? "Aceptar nuevo precio"
                  : "Quitar de la bolsa"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CheckoutFlow() {
  const cartItems = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const remove = useCart((s) => s.remove);
  const reprice = useCart((s) => s.reprice);

  const [paso, setPaso] = useState<Paso>(1);
  const [datos, setDatos] = useState<DatosEntrega>({
    nombre: "",
    celular: "",
    email: "",
    documentType: "CC",
    documentId: "",
    department: "Antioquia",
    ciudad: "Medellín",
    direccion: "",
    notas: "",
  });
  const [metodo, setMetodo] = useState<MetodoPago>("contraentrega");
  // One key per checkout attempt: if the request is retried, the server
  // finds the order the first attempt created instead of creating another.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [conflictos, setConflictos] = useState<LineConflict[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Frozen at confirmation so the summary survives clearing the bag.
  const [confirmado, setConfirmado] = useState<{
    items: CartItem[];
    orderNumber: string;
  } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso, confirmado]);

  const accion = useAction(createOrder, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.ok) {
        setConfirmado({ items: cartItems, orderNumber: data.orderNumber });
        clear();
      } else if (data.code === "DEMO_MODE") {
        setErrorMsg(
          "Esta es la tienda de demostración: los pedidos todavía no se registran. Escríbenos por WhatsApp y coordinamos tu compra.",
        );
      } else {
        setConflictos(data.conflicts);
      }
    },
    onError: ({ error }) => {
      setErrorMsg(
        error.serverError ??
          "No pudimos registrar tu pedido. Intenta de nuevo o escríbenos por WhatsApp.",
      );
    },
  });
  const enviando = accion.status === "executing";

  const items = confirmado?.items ?? cartItems;
  const vacia = items.length === 0;
  const subtotal = subtotalCents(items);
  const total = subtotal + (vacia ? 0 : SHIPPING_CENTS);

  function confirmar() {
    setErrorMsg(null);
    setConflictos(null);
    if (metodo === "online" && datos.email.trim() === "") {
      setErrorMsg("Para pagar en línea necesitamos tu correo.");
      setPaso(2);
      return;
    }
    accion.execute({
      idempotencyKey,
      items: cartItems.map((i) => ({
        variantId: i.variantId,
        qty: i.qty,
        expectedPriceCents: i.priceCents,
      })),
      delivery: {
        nombre: datos.nombre,
        celular: datos.celular,
        email: datos.email.trim() === "" ? undefined : datos.email,
        documentType: datos.documentType,
        documentId: datos.documentId,
        department: datos.department,
        ciudad: datos.ciudad,
        direccion: datos.direccion,
        notas: datos.notas === "" ? undefined : datos.notas,
      },
      paymentMethod: metodo === "contraentrega" ? "CASH_ON_DELIVERY" : "ONLINE",
    });
  }

  function resolverConflicto(c: LineConflict) {
    if (c.reason === "PRICE_CHANGED" && c.currentPriceCents !== undefined) {
      reprice(c.variantId, c.currentPriceCents);
    } else {
      remove(c.variantId);
    }
    setConflictos((prev) => {
      const rest = prev?.filter((x) => x.variantId !== c.variantId) ?? [];
      return rest.length > 0 ? rest : null;
    });
  }

  function set<K extends keyof DatosEntrega>(key: K, value: DatosEntrega[K]) {
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
              <p className="kicker mt-6">Tu pedido</p>
              <p className="mt-1 font-display text-2xl text-vino">
                {confirmado.orderNumber}
              </p>
              <p className="mx-auto mt-4 max-w-[44ch] font-light">
                Guarda este código. Te escribimos por WhatsApp para coordinar
                el pago y la entrega. Recuerda: caja neutra, remitente genérico
                — <strong className="font-medium">tu secreto está a salvo</strong>
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
                  <span className={labelClass}>
                    Correo{" "}
                    <span className="font-light text-tenue">
                      (opcional si pagas contra entrega)
                    </span>
                  </span>
                  <Input
                    type="email"
                    required={metodo === "online"}
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    value={datos.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                  <label>
                    <span className={labelClass}>Documento</span>
                    <Select
                      value={datos.documentType}
                      onChange={(e) =>
                        set(
                          "documentType",
                          e.target.value as DatosEntrega["documentType"],
                        )
                      }
                    >
                      {DOCUMENTOS.map(([value, nombre]) => (
                        <option key={value} value={value}>
                          {nombre}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    <span className={labelClass}>Número de documento</span>
                    <Input
                      required
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="1234567890"
                      value={datos.documentId}
                      onChange={(e) => set("documentId", e.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Departamento</span>
                    <Select
                      value={datos.department}
                      onChange={(e) =>
                        set(
                          "department",
                          e.target.value as DatosEntrega["department"],
                        )
                      }
                    >
                      {DEPARTAMENTOS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    <span className={labelClass}>Ciudad</span>
                    <Input
                      required
                      autoComplete="address-level2"
                      placeholder="Medellín"
                      value={datos.ciudad}
                      onChange={(e) => set("ciudad", e.target.value)}
                    />
                  </label>
                </div>
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
                  personales&rdquo;. Tu documento es solo para la guía y la
                  factura.
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

              {errorMsg && (
                <p role="alert" className="mt-6 text-sm text-error">
                  {errorMsg}
                </p>
              )}
              {conflictos && (
                <ConflictPanel
                  conflictos={conflictos}
                  itemName={(variantId) =>
                    cartItems.find((i) => i.variantId === variantId)?.name ??
                    null
                  }
                  onResolve={resolverConflicto}
                />
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  variant="ghost"
                  disabled={enviando}
                  onClick={() => setPaso(2)}
                >
                  ← Volver
                </Button>
                <Button
                  className="flex-1"
                  disabled={enviando || vacia || conflictos !== null}
                  onClick={confirmar}
                >
                  {enviando ? "Confirmando…" : "Confirmar pedido"}
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
