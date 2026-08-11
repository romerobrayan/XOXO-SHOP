import type { Metadata } from "next";
import Link from "next/link";

import { LegalArticle } from "@/components/site/LegalArticle";
import { WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";
import { legalPage, responsableLinea } from "@/lib/legal";

const page = legalPage("terminos");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

// Términos y condiciones de venta. Describen la operación tal como funciona
// hoy — contra entrega en Medellín, pago en línea y coordinación por WhatsApp —
// y no prometen medios de pago que todavía no existen.
export default function TerminosPage() {
  return (
    <LegalArticle
      slug="terminos"
      kicker="Condiciones de venta"
      lead="Las reglas de comprar acá, escritas para que se entiendan a la primera."
    >
      <h2>Quién opera esta tienda</h2>
      <p>
        Esta tienda es operada por {responsableLinea()}. Al hacer un pedido
        aceptas estos términos, que se rigen por la ley colombiana y, en
        particular, por la Ley 1480 de 2011 —el Estatuto del Consumidor— y por
        el régimen de comercio electrónico de la Ley 527 de 1999.
      </p>

      <h2>Solo para mayores de 18 años</h2>
      <p>
        Vendemos productos para adultos. Al entrar confirmas que tienes 18 años
        o más y que compras para tu uso personal. Si detectamos que un pedido lo
        hizo una persona menor de edad, lo cancelamos.
      </p>

      <h2>Productos, precios e impuestos</h2>
      <ul>
        <li>
          Todos los precios están en <strong>pesos colombianos (COP)</strong> e{" "}
          <strong>incluyen el IVA</strong>. Lo único que se suma aparte es el
          costo de envío, que ves en el resumen antes de confirmar.
        </li>
        <li>
          Las fotografías y descripciones buscan ser fieles al producto. Las
          medidas y los materiales son los que declara el fabricante.
        </li>
        <li>
          Los precios pueden cambiar sin aviso previo, pero{" "}
          <strong>nunca después de que confirmes tu pedido</strong>: el precio
          que se te cobra es el que viste al confirmar. Si algo cambió mientras
          comprabas, te lo mostramos y decides antes de continuar.
        </li>
      </ul>

      <h2>Cómo se hace un pedido</h2>
      <ul>
        <li>
          <strong>No necesitas crear una cuenta.</strong> Puedes comprar como
          invitado.
        </li>
        <li>
          Al confirmar, apartamos las unidades de tu pedido para que nadie más
          las compre mientras lo procesamos.
        </li>
        <li>
          Recibes un número de pedido que empieza por <strong>SECRETO-</strong>.
          Guárdalo: con él coordinamos todo por WhatsApp.
        </li>
        <li>
          El pedido queda en firme cuando te lo confirmamos. Si no podemos
          cumplirlo, te avisamos y te devolvemos lo que hayas pagado.
        </li>
      </ul>

      <h2>Disponibilidad y errores</h2>
      <p>
        Trabajamos con inventario real y lo descontamos en el momento de la
        compra, pero si por un error nuestro un producto aparece disponible y no
        lo está, te lo decimos de inmediato y eliges entre esperarlo, cambiarlo
        o que te devolvamos el dinero. Lo mismo aplica a un error evidente de
        precio: te lo informamos antes de despachar y tú decides, sin costo.
      </p>

      <h2>Medios de pago</h2>
      <ul>
        <li>
          <strong>Contra entrega en Medellín.</strong> Pagas en efectivo cuando
          recibes, y revisas la caja antes de pagar.
        </li>
        <li>
          <strong>Pago en línea</strong> con tarjeta, PSE, Nequi o
          transferencia, procesado por una pasarela de pagos autorizada.
          Nosotros <strong>no almacenamos los datos de tu tarjeta</strong>: los
          recibe y los guarda la pasarela.
        </li>
      </ul>
      <p>
        El cobro aparece en tu extracto con un descriptor neutro —
        <strong>&ldquo;SECRETO BTQ&rdquo;</strong>— que no menciona la categoría
        ni los productos.
      </p>

      <h2>Envío, entrega y discreción</h2>
      <p>
        La cobertura, el costo, los tiempos y la forma exacta en que empacamos
        están en <Link href="/legal/envios">Envíos y empaque discreto</Link>. El
        empaque neutro no es un extra opcional: es como despachamos todos los
        pedidos.
      </p>

      <h2>Garantía y devoluciones</h2>
      <p>
        Tus productos tienen garantía legal, y el derecho de retracto funciona
        distinto en productos íntimos. Las dos cosas están explicadas con
        precisión en{" "}
        <Link href="/legal/devoluciones">
          Devoluciones, garantía y retracto
        </Link>
        .
      </p>

      <h2>Tus datos personales</h2>
      <p>
        Qué guardamos, para qué y cómo lo borras está en la{" "}
        <Link href="/legal/privacidad">
          política de tratamiento de datos personales
        </Link>
        .
      </p>

      <h2>Uso del sitio y contenidos</h2>
      <p>
        La marca, los textos, el diseño y las imágenes de este sitio están
        protegidos por derechos de autor y de propiedad industrial. Puedes
        verlos y compartirlos; no puedes reproducirlos con fines comerciales sin
        nuestra autorización escrita. Las marcas de los fabricantes pertenecen a
        sus titulares.
      </p>
      <p>
        No está permitido usar el sitio para revender nuestros productos como
        distribuidor sin un acuerdo previo, ni intentar acceder a partes del
        sistema que no son públicas.
      </p>

      <h2>Nuestra responsabilidad</h2>
      <p>
        Respondemos por lo que la ley colombiana nos exige responder: que el
        producto sea el que ofrecimos, que funcione, y que llegue. La
        información del sitio sobre uso de los productos es orientativa y no
        reemplaza las indicaciones del fabricante ni una consulta médica. Sigue
        siempre las instrucciones del empaque, sobre todo en materiales,
        compatibilidad de lubricantes y limpieza.
      </p>

      <h2>Preguntas, quejas y reclamos</h2>
      <p>
        Escríbenos por{" "}
        <a
          href={whatsappHref("Hola, tengo una pregunta sobre mi pedido")}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp al {WHATSAPP_DISPLAY}
        </a>{" "}
        con tu número de pedido. Si no quedas conforme con nuestra respuesta,
        puedes acudir a la Superintendencia de Industria y Comercio, que es la
        autoridad de protección al consumidor en Colombia.
      </p>

      <h2>Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia y
        cualquier controversia se somete a los jueces colombianos.
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos actualizar estos términos. La versión vigente es siempre la
        publicada en esta página, con su fecha de actualización, y a tu pedido
        se le aplica la versión que estaba publicada cuando lo hiciste.
      </p>
    </LegalArticle>
  );
}
