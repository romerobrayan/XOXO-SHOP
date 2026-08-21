import type { Metadata } from "next";
import Link from "next/link";

import { LegalArticle } from "@/components/site/LegalArticle";
import { getShippingZones } from "@/features/shipping/queries";
import { hasNationalZone } from "@/features/shipping/zones";
import { WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";
import { legalPage } from "@/lib/legal";
import { formatCOP } from "@/lib/money";

const page = legalPage("envios");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

// Misma razón que en /checkout: la promesa de esta página es que lo publicado
// y lo cobrado no pueden divergir. Prerenderizada, publicaría las zonas del
// build en vez de las vigentes.
export const dynamic = "force-dynamic";

// Política de envíos. Las tarifas salen de las MISMAS zonas que cobra el
// checkout (src/features/shipping/queries.ts), así que la página publicada y
// el cobro real no pueden divergir: la clienta edita una zona en
// /admin/domicilios y cambian las dos. Mientras no haya zonas cargadas, la
// consulta responde con la tarifa plana histórica y la página se lee como
// siempre — un solo precio nacional.
//
// PENDIENTE: el remitente exacto que va impreso en la guía. Acá se promete lo
// que sí está decidido —remitente neutro, sin marca ni categoría— sin
// comprometer una cadena concreta que la clienta todavía no eligió.
export default async function EnviosPage() {
  const zones = await getShippingZones();
  const cubreTodoElPais = hasNationalZone(zones);
  // Con una sola zona no hay tabla que mostrar: es una tarifa, y se dice en
  // una frase.
  const tarifaUnica = zones.length === 1 ? zones[0] : null;

  return (
    <LegalArticle
      slug="envios"
      kicker="Cobertura y empaque"
      lead="Enviamos a toda Colombia. Y la caja no dice qué trae — eso es parte del producto, no un favor."
    >
      <h2>A dónde llegamos</h2>
      <p>
        Enviamos a <strong>todo el territorio nacional</strong>. En Medellín y
        su área metropolitana, además, puedes pagar contra entrega.
      </p>

      <h2>Cuánto cuesta</h2>
      {tarifaUnica ? (
        <p>
          El envío tiene una tarifa de{" "}
          <strong>{formatCOP(tarifaUnica.priceCents)}</strong> a cualquier
          destino del país. Lo ves sumado en el resumen antes de confirmar el
          pedido, nunca después.
        </p>
      ) : (
        <>
          <p>
            El domicilio depende de a dónde va, porque a nosotros también nos
            cuesta distinto. Estas son las tarifas vigentes:
          </p>
          <ul>
            {zones.map((zone) => (
              <li key={zone.id}>
                <strong>{zone.name}</strong> — {formatCOP(zone.priceCents)}
                {zone.areas.length > 0 && <>. Cubre {zone.areas.join(", ")}</>}
                {zone.kind === "GENERAL" && zone.department && (
                  <>. Resto de {zone.department}</>
                )}
                {zone.note && <>. {zone.note}</>}
              </li>
            ))}
          </ul>
          <p>
            Escribes tu ciudad y tu barrio en el segundo paso del checkout y el
            resumen te muestra el valor exacto antes de confirmar, nunca
            después.{" "}
            {cubreTodoElPais
              ? "Si tu dirección no calza en ninguna zona de la lista, aplica la tarifa nacional."
              : "Si tu dirección no calza en ninguna zona de la lista, lo coordinamos contigo por WhatsApp antes de despachar."}
          </p>
        </>
      )}

      <h2>Cuánto se demora</h2>
      <p>
        Preparamos tu pedido en días hábiles. Cuando lo despachamos te
        escribimos por WhatsApp con la fecha estimada de entrega y el número de
        guía, para que sepas exactamente cuándo esperar la caja y puedas estar
        pendiente tú.
      </p>
      <p>
        Los tiempos dependen de la transportadora y del destino. Los fines de
        semana y festivos no cuentan como días hábiles.
      </p>

      <h2>Empaque discreto</h2>
      <p>
        Todos los pedidos salen en empaque neutro. No es una opción que tengas
        que marcar: es como despachamos siempre.
      </p>
      <ul>
        <li>
          Caja o bolsa <strong>opaca, sin marca</strong>: ni logo, ni nombre de
          la tienda, ni colores que la identifiquen.
        </li>
        <li>
          <strong>Sin imágenes ni descripciones del contenido</strong> por
          fuera. Desde afuera no se distingue de cualquier otro paquete.
        </li>
        <li>
          El <strong>remitente es neutro</strong> y no menciona la tienda ni la
          categoría de los productos.
        </li>
        <li>
          La guía de la transportadora no describe lo que va adentro. La
          transportadora recibe tu nombre, tu dirección y tu teléfono, y nada
          más.
        </li>
        <li>
          Los productos van protegidos individualmente adentro, con su empaque
          original y su sello de higiene intacto.
        </li>
      </ul>
      <p>
        Si necesitas que la entrega ocurra de una forma particular —una
        dirección alterna, un horario, que reciba otra persona— dínoslo por
        WhatsApp cuando confirmes el pedido y lo coordinamos.
      </p>

      <h2>Contra entrega en Medellín</h2>
      <p>
        Pagas en efectivo cuando te llega. Puedes revisar la caja antes de
        pagar. Ten listo el valor exacto si puedes: no siempre hay cómo dar
        cambio.
      </p>

      <h2>Si no estás cuando llega</h2>
      <p>
        La transportadora suele hacer un segundo intento y te contacta al
        teléfono que registraste. Por eso el celular tiene que estar bien: es
        nuestra forma de encontrarte. Si el pedido se devuelve por no poder
        entregarlo, te escribimos para reprogramarlo; un segundo despacho puede
        implicar un nuevo costo de envío.
      </p>

      <h2>Si algo sale mal</h2>
      <p>
        Si tu pedido no llega en el plazo que te dimos, si la caja llega abierta
        o dañada, o si lo que hay adentro no es lo que pediste, escríbenos por{" "}
        <a
          href={whatsappHref(
            "Hola, tengo un problema con la entrega de mi pedido",
          )}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp al {WHATSAPP_DISPLAY}
        </a>{" "}
        con tu número de pedido. Lo resolvemos nosotros: no te mandamos a pelear
        con la transportadora.
      </p>
      <p>
        Qué pasa después —reposición, garantía o devolución del dinero— está en{" "}
        <Link href="/legal/devoluciones">
          Devoluciones, garantía y retracto
        </Link>
        .
      </p>
    </LegalArticle>
  );
}
