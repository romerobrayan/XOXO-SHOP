import type { Metadata } from "next";
import Link from "next/link";

import { LegalArticle } from "@/components/site/LegalArticle";
import { WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";
import { legalPage } from "@/lib/legal";

const page = legalPage("devoluciones");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

// Devoluciones, garantía legal y retracto.
//
// La pieza delicada es el retracto. El artículo 47 de la Ley 1480 de 2011 da
// 5 días hábiles en ventas a distancia, PERO el mismo artículo excluye los
// bienes de uso personal y los que por su naturaleza no pueden devolverse —
// que es exactamente lo que vende esta tienda. La regla de CLAUDE.md es
// decirlo con precisión: ni prometer un derecho que no aplica, ni callarlo.
//
// Las excepciones se citan en palabras y no por numeral a propósito: el
// artículo se cita, la lista se describe. Un numeral equivocado en una página
// legal publicada es peor que no numerarla.
//
// La garantía legal, en cambio, NO tiene excepción por categoría y es lo que
// sostiene la credibilidad de esta página: un año para productos nuevos
// cuando el fabricante no anuncia un plazo mayor (Ley 1480, arts. 7 y 8).
export default function DevolucionesPage() {
  return (
    <LegalArticle
      slug="devoluciones"
      kicker="Estatuto del Consumidor"
      lead="Acá va algo que casi ninguna tienda de esta categoría explica bien: la garantía te cubre siempre, pero el retracto de cinco días no funciona igual con productos íntimos. Te decimos exactamente por qué."
    >
      <h2>Garantía legal: esto sí te cubre siempre</h2>
      <p>
        Todo lo que vendemos tiene <strong>garantía legal</strong> en los
        términos de la Ley 1480 de 2011. Es una obligación nuestra, no un
        beneficio que otorgamos, y no depende de la categoría del producto.
      </p>
      <p>
        El plazo es el que anuncie el fabricante y, cuando no anuncia ninguno,
        es de <strong>un (1) año para productos nuevos</strong>, contado desde
        que recibes el pedido.
      </p>
      <p>La garantía responde cuando el producto:</p>
      <ul>
        <li>Llega defectuoso, averiado o incompleto.</li>
        <li>Deja de funcionar dentro del plazo por una falla propia.</li>
        <li>
          No corresponde a lo que compraste: otra referencia, otra talla, otro
          color.
        </li>
        <li>
          No cumple las condiciones de calidad, idoneidad o seguridad que
          ofrecimos.
        </li>
      </ul>
      <p>
        Cuando la garantía procede, la ley te da derecho a la reparación
        gratuita y, si la falla se repite o la reparación no es posible, al
        cambio del producto o a la devolución del dinero que pagaste.
      </p>
      <p>
        <strong>La garantía no cubre</strong> el desgaste normal por uso, los
        daños causados por un uso distinto al indicado por el fabricante, la
        falta de limpieza o mantenimiento, ni el uso de lubricantes
        incompatibles con el material —los de silicona deterioran los juguetes
        de silicona, y eso viene advertido en el empaque—.
      </p>

      <h2>Derecho de retracto: por qué acá funciona distinto</h2>
      <p>
        El artículo 47 de la Ley 1480 de 2011 da al comprador cinco (5) días
        hábiles para retractarse de una compra hecha a distancia. Pero{" "}
        <strong>ese mismo artículo excluye del retracto</strong>, entre otros,
        los <strong>bienes de uso personal</strong> y los que{" "}
        <strong>por su naturaleza no pueden devolverse</strong>.
      </p>
      <p>
        Los productos íntimos, la lencería y la cosmética íntima que vendemos
        caen en esas excepciones. La razón es sanitaria y es simple: una vez que
        el producto sale de su empaque sellado, no puede volver al inventario ni
        llegar a otra persona.
      </p>
      <p>
        Por eso,{" "}
        <strong>si abriste el sello de higiene, el retracto no aplica</strong>.
        Preferimos decírtelo antes de que compres y no cuando nos escribas.
      </p>
      <p>
        Esto no toca en nada tu garantía legal: si el producto llegó defectuoso
        o falló, respondemos aunque lo hayas abierto. Son dos cosas distintas y
        la excepción del retracto no se contagia a la garantía.
      </p>

      <h2>Qué sí podemos resolverte</h2>
      <ul>
        <li>
          <strong>Te llegó lo que no era</strong> —otra referencia, otra talla,
          otro color del que pediste—: lo cambiamos y el envío corre por nuestra
          cuenta.
        </li>
        <li>
          <strong>Llegó dañado o abierto:</strong> tómale una foto a la caja
          antes de desempacar más y escríbenos el mismo día. Lo reponemos.
        </li>
        <li>
          <strong>Está sellado y no lo has abierto:</strong> escríbenos dentro
          de los cinco (5) días hábiles siguientes a la entrega y lo evaluamos
          contigo. Si procede, el producto debe estar en las mismas condiciones
          en que lo recibiste y con su sello intacto, y los costos de transporte
          de la devolución corren por tu cuenta, como lo prevé la ley.
        </li>
        <li>
          <strong>Falló dentro del plazo de garantía:</strong> escríbenos con tu
          número de pedido y activamos la garantía.
        </li>
      </ul>

      <h2>Reversión del pago</h2>
      <p>
        Si pagaste en línea con tarjeta u otro medio de pago electrónico, el
        artículo 51 de la Ley 1480 de 2011 te permite solicitar la{" "}
        <strong>reversión del pago</strong> cuando fuiste víctima de fraude,
        cuando el producto no fue el solicitado, cuando llegó defectuoso o
        cuando no te fue entregado.
      </p>
      <p>
        La solicitud se presenta dentro de los cinco (5) días hábiles siguientes
        a que tengas noticia del hecho, y se dirige a nosotros y a tu entidad
        emisora. Si te pasa, escríbenos primero: casi siempre lo resolvemos más
        rápido de forma directa.
      </p>

      <h2>Cómo hacer un reclamo</h2>
      <p>
        Escríbenos por{" "}
        <a
          href={whatsappHref("Hola, quiero hacer un reclamo sobre mi pedido")}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp al {WHATSAPP_DISPLAY}
        </a>{" "}
        con tres cosas: tu <strong>número de pedido</strong> (el que empieza por
        SECRETO-), qué pasó, y una foto si el problema se ve. No necesitas
        explicar para qué era el producto ni justificar nada.
      </p>
      <p>
        Te respondemos en días hábiles y te decimos qué sigue. Si no quedas
        conforme, puedes acudir a la Superintendencia de Industria y Comercio.
      </p>
      <p>
        Las condiciones generales de la compra están en{" "}
        <Link href="/legal/terminos">Términos y condiciones</Link>, y cómo
        empacamos y despachamos en{" "}
        <Link href="/legal/envios">Envíos y empaque discreto</Link>.
      </p>
    </LegalArticle>
  );
}
