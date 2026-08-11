import type { Metadata } from "next";
import Link from "next/link";

import { LegalArticle } from "@/components/site/LegalArticle";
import { SHIPPING_CENTS } from "@/features/checkout/shipping";
import { WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";
import { legalPage } from "@/lib/legal";
import { formatCOP } from "@/lib/money";

const page = legalPage("envios");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

// Política de envíos. La tarifa sale de SHIPPING_CENTS —la misma constante que
// cobra el checkout— para que la página publicada y el cobro real no puedan
// divergir: cuando la clienta confirme su tarifa (plana, por ciudad o gratis
// desde un monto, ESTADO §6), cambia una constante y cambian las dos.
//
// PENDIENTE: el remitente exacto que va impreso en la guía. Acá se promete lo
// que sí está decidido —remitente neutro, sin marca ni categoría— sin
// comprometer una cadena concreta que la clienta todavía no eligió.
export default function EnviosPage() {
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
      <p>
        El envío tiene una tarifa de{" "}
        <strong>{formatCOP(SHIPPING_CENTS)}</strong> a cualquier destino del
        país. Lo ves sumado en el resumen antes de confirmar el pedido, nunca
        después.
      </p>

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
