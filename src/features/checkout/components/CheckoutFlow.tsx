"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Price } from "@/features/catalog/components/Price";
import { subtotalCents, useCart, type CartItem } from "@/features/cart/store";
import { createOrder, type LineConflict } from "@/features/checkout/actions";
import { DEPARTAMENTOS } from "@/features/checkout/schemas";
import {
  resolveShipping,
  WHATSAPP_ZONE_ID,
  zonesForDepartment,
  type ShippingQuote,
  type ShippingZoneDTO,
} from "@/features/shipping/zones";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

// Checkout en 3 pasos per handoff §4 — Bolsa, Datos, Pago — con confirmación
// en la misma vista (el stepper desaparece al confirmar). Bloque C: confirmar
// llama al Server Action createOrder, que re-lee precios de la base, escribe
// Order + OrderItem con snapshots y reserva stock. La bolsa se vacía solo
// cuando el servidor confirma.
//
// El domicilio se cotiza por zona (src/features/shipping/zones.ts), así que el
// resumen NO muestra un monto antes de tener dirección: en el paso 1 dice que
// se calcula, y desde el paso 2 se actualiza en vivo con lo que la compradora
// escribe. Acá eso es presentación; quien decide el cobro es el Server Action,
// que vuelve a resolver la zona contra la base.

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
  barrio: string;
  direccion: string;
  // "" = automática: la zona la decide la ciudad o el barrio. Un valor
  // explícito es una elección de la compradora y manda sobre el match.
  shippingZoneId: string;
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
      {/* La foto del producto, la misma que la compradora vio en la ficha.
          Sin foto cargada cae al placeholder oficial de rayas —nunca una
          imagen genérica de reemplazo (CLAUDE.md). */}
      <div className="w-[88px] shrink-0">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-sm bg-arena object-cover object-center"
          />
        ) : (
          <ProductImagePlaceholder
            name={item.name}
            size="thumb"
            className="rounded-sm"
          />
        )}
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

export function CheckoutFlow({ zones }: { zones: ShippingZoneDTO[] }) {
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
    barrio: "",
    direccion: "",
    shippingZoneId: "",
    notas: "",
  });
  // El resumen no puede cotizar un domicilio antes de saber a dónde va. Se
  // enciende al terminar el paso 2 y ya no se apaga: volver a la bolsa
  // conserva el monto en vez de borrarlo.
  const [direccionLista, setDireccionLista] = useState(false);
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
  // True from "the server handed us a payment link" until the browser
  // actually leaves — keeps the button disabled while navigation happens.
  const [redirigiendo, setRedirigiendo] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso, confirmado]);

  const accion = useAction(createOrder, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.ok) {
        if (data.checkoutUrl) {
          // Online payment: the order exists and its stock is reserved, so
          // the bag's job is done — leaving items in it would invite a second
          // order for the same units. Confirmation happens on the return
          // page, driven by the webhook, never by this redirect.
          setRedirigiendo(true);
          clear();
          window.location.assign(data.checkoutUrl);
          return;
        }
        setConfirmado({ items: cartItems, orderNumber: data.orderNumber });
        clear();
      } else if (data.code === "DEMO_MODE") {
        setErrorMsg(
          "Esta es la tienda de demostración: los pedidos todavía no se registran. Escríbenos por WhatsApp y coordinamos tu compra.",
        );
      } else if (data.code === "SHIPPING_UNQUOTED") {
        setErrorMsg(
          "Todavía no tenemos una tarifa de domicilio para esta dirección. Escríbenos por WhatsApp y la coordinamos contigo.",
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
  const enviando = accion.status === "executing" || redirigiendo;

  const items = confirmado?.items ?? cartItems;
  const vacia = items.length === 0;
  const subtotal = subtotalCents(items);

  // Las zonas que se le ofrecen a este departamento y la que le tocaría por
  // ciudad o barrio si no elige ninguna: el <select> muestra la automática
  // seleccionada, así el monto del resumen y la opción marcada coinciden.
  const zonasOfrecidas = zonesForDepartment(zones, datos.department);
  const automatica = resolveShipping(zones, {
    department: datos.department,
    ciudad: datos.ciudad,
    barrio: datos.barrio,
  });
  const zonaElegida =
    datos.shippingZoneId ||
    (automatica.status === "QUOTED" ? automatica.zoneId : WHATSAPP_ZONE_ID);

  // Antes de tener dirección no hay domicilio que cotizar (paso 1).
  const cotizacion: ShippingQuote | null = direccionLista
    ? resolveShipping(zones, {
        department: datos.department,
        ciudad: datos.ciudad,
        barrio: datos.barrio,
        zoneId: datos.shippingZoneId,
      })
    : null;
  const envioCents = cotizacion?.status === "QUOTED" ? cotizacion.priceCents : null;
  const total = subtotal + (vacia || envioCents === null ? 0 : envioCents);
  // Sin cotización no hay pedido que confirmar: el monto lo acuerda una
  // asesora por WhatsApp, no lo inventa el checkout.
  const sinCotizacion = cotizacion?.status === "UNQUOTED";

  // Mensaje del CTA de WhatsApp del resumen. Lleva a dónde va el pedido y
  // cuánto suma — nunca qué productos son: la discreción es requisito de
  // producto, no una preferencia (CLAUDE.md).
  const mensajeDomicilio = [
    "Hola, quiero coordinar el domicilio de mi pedido.",
    `Ciudad: ${datos.ciudad || "—"}${datos.barrio ? ` · Barrio: ${datos.barrio}` : ""}`,
    `Departamento: ${datos.department}`,
    `Productos: ${items.reduce((n, i) => n + i.qty, 0)} · Subtotal: ${formatCOP(subtotal)}`,
  ].join("\n");

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
        barrio: datos.barrio === "" ? undefined : datos.barrio,
        direccion: datos.direccion,
        // Solo la elección viaja; el precio lo resuelve el servidor.
        shippingZoneId: datos.shippingZoneId || undefined,
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
                  setDireccionLista(true);
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
                        // Cambiar de departamento cambia las zonas que se
                        // ofrecen, así que una elección anterior deja de
                        // aplicar: vuelve a automática.
                        setDatos((prev) => ({
                          ...prev,
                          department: e.target
                            .value as DatosEntrega["department"],
                          shippingZoneId: "",
                        }))
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
                <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                  <label>
                    <span className={labelClass}>
                      Barrio{" "}
                      <span className="font-light text-tenue">(opcional)</span>
                    </span>
                    <Input
                      autoComplete="address-level3"
                      placeholder="Ej: Laureles"
                      value={datos.barrio}
                      onChange={(e) => set("barrio", e.target.value)}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Zona de entrega</span>
                    <Select
                      value={zonaElegida}
                      onChange={(e) => set("shippingZoneId", e.target.value)}
                    >
                      {zonasOfrecidas.map((zona) => (
                        <option key={zona.id} value={zona.id}>
                          {zona.name} — {formatCOP(zona.priceCents)}
                        </option>
                      ))}
                      <option value={WHATSAPP_ZONE_ID}>
                        Mi zona no aparece — coordinar por WhatsApp
                      </option>
                    </Select>
                  </label>
                </div>
                {/* Por qué está marcada esa zona, o qué pasa si eligió salir
                    de la lista. El precio ya se ve en el resumen. */}
                <p className="-mt-1 text-sm font-light text-suave">
                  {zonaElegida === WHATSAPP_ZONE_ID
                    ? "Coordinamos el valor del domicilio contigo por WhatsApp antes de despachar."
                    : datos.shippingZoneId
                      ? "Elegiste esta zona. Si no es la tuya, cámbiala aquí."
                      : "La elegimos por tu ciudad y tu barrio. Puedes cambiarla."}
                  {zonasOfrecidas.find((z) => z.id === zonaElegida)?.note
                    ? ` ${zonasOfrecidas.find((z) => z.id === zonaElegida)!.note}`
                    : ""}
                </p>
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

              {sinCotizacion && (
                <div className="mt-6 rounded-md border border-oro bg-arena p-4">
                  <p className="text-sm leading-relaxed">
                    Falta acordar el domicilio a esta dirección. Escríbenos y
                    una asesora te confirma el valor y cierra el pedido
                    contigo; no perdemos nada de lo que ya elegiste.
                  </p>
                  <WhatsAppCta message={mensajeDomicilio} className="mt-3">
                    Coordinar mi domicilio
                  </WhatsAppCta>
                </div>
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
                  disabled={
                    enviando || vacia || conflictos !== null || sinCotizacion
                  }
                  onClick={confirmar}
                >
                  {redirigiendo
                    ? "Llevándote al pago…"
                    : enviando
                      ? "Confirmando…"
                      : sinCotizacion
                        ? "Falta el domicilio"
                        : "Confirmar pedido"}
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
              <div className="mt-1 flex justify-between gap-3 border-t border-linea pt-3">
                <span>Subtotal</span>
                <span className="tabular shrink-0">{formatCOP(subtotal)}</span>
              </div>
              {/* El domicilio no aparece como número hasta que hay dirección:
                  mostrar uno antes sería adivinarlo y después corregirlo. */}
              <div className="flex justify-between gap-3 text-suave">
                <span className="min-w-0">
                  Envío discreto
                  {cotizacion?.status === "QUOTED" && (
                    <span className="block text-xs text-tenue">
                      {cotizacion.zoneName}
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0">
                  {envioCents !== null
                    ? formatCOP(envioCents)
                    : sinCotizacion
                      ? "A convenir"
                      : "Se calcula con tu dirección"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-linea pt-3">
                <span className="font-medium text-tinta">Total</span>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <Price cents={total} size="lg" />
                  {envioCents === null && (
                    <span className="text-xs text-tenue">+ envío</span>
                  )}
                </span>
              </div>
            </div>
          )}
          <div className="mt-4 grid justify-items-start gap-2">
            <Badge>Empaque neutro</Badge>
            <Badge>Remitente genérico</Badge>
            <Badge variant="exito">Garantía 6 meses</Badge>
          </div>
          {/* El canal real del negocio, siempre a la vista: negociar el
              domicilio por WhatsApp queda disponible aunque ya haya una
              tarifa calculada, no solo cuando no hay ninguna. */}
          <WhatsAppCta
            message={
              direccionLista
                ? mensajeDomicilio
                : "Hola, necesito ayuda con mi pedido"
            }
            className="mt-4 w-full"
          >
            {direccionLista ? "Coordinar el domicilio" : "¿Ayuda? Escríbenos"}
          </WhatsAppCta>
        </aside>
      </div>
    </div>
  );
}
