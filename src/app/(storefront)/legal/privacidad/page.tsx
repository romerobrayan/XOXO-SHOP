import type { Metadata } from "next";

import { LegalArticle } from "@/components/site/LegalArticle";
import { WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";
import { legalPage, RESPONSABLE, responsableLinea } from "@/lib/legal";

const page = legalPage("privacidad");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

// Política de tratamiento de datos — Ley 1581 de 2012 y Decreto 1377 de 2013.
//
// El bloque que hace que esta página no sea una plantilla es "Datos sensibles":
// el art. 5 de la Ley 1581 clasifica como sensibles los datos relativos a la
// vida sexual, y en esta categoría el historial de compras revela justamente
// eso. Decirlo explícitamente, y decir qué NO hacemos con ese dato, es a la vez
// la obligación legal y el argumento de confianza de la tienda.
export default function PrivacidadPage() {
  return (
    <LegalArticle
      slug="privacidad"
      kicker="Ley 1581 de 2012"
      lead="Compraste algo íntimo. Lo mínimo que te debemos es contarte con precisión qué sabemos de ti, para qué lo usamos y cómo lo borras."
    >
      <h2>Quién responde por tus datos</h2>
      <p>
        El responsable del tratamiento de tus datos personales es{" "}
        {responsableLinea()}. Nuestros canales de atención para cualquier
        solicitud sobre esta política son{" "}
        <a
          href={whatsappHref(
            "Hola, tengo una solicitud sobre mis datos personales",
          )}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp al {WHATSAPP_DISPLAY}
        </a>
        {RESPONSABLE.correo ? (
          <>
            {" y el correo "}
            <a href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>
          </>
        ) : null}
        .
      </p>

      <h2>Qué datos guardamos</h2>
      <p>Solo lo que necesitamos para venderte y entregarte un pedido:</p>
      <ul>
        <li>
          <strong>Para el pedido:</strong> tu nombre, tipo y número de
          documento, celular y, si nos lo das, tu correo. El documento es
          obligatorio porque la factura en Colombia lo exige.
        </li>
        <li>
          <strong>Para la entrega:</strong> departamento, ciudad y dirección.
        </li>
        <li>
          <strong>Del pedido en sí:</strong> qué compraste, cuánto pagaste, cómo
          pagaste y en qué estado va.
        </li>
        <li>
          <strong>De la visita:</strong> la confirmación de que eres mayor de
          edad, guardada en una cookie de tu navegador.
        </li>
      </ul>

      <h2>Lo que decidimos no guardar</h2>
      <p>
        La confirmación de mayoría de edad guarda únicamente un{" "}
        <strong>sí</strong> y la fecha en que lo diste.{" "}
        <strong>No te pedimos ni almacenamos tu fecha de nacimiento.</strong> No
        hace falta para cumplir la norma y es un dato menos que podríamos
        perder.
      </p>
      <p>
        Tampoco necesitas crear una cuenta para comprar. Puedes hacerlo como
        invitado, y en ese caso tus datos viven asociados a ese pedido y no a un
        perfil.
      </p>

      <h2>Datos sensibles: tu vida privada</h2>
      <p>
        El artículo 5 de la Ley 1581 de 2012 considera{" "}
        <strong>datos sensibles</strong> los que se refieren a la vida sexual de
        una persona. Por lo que vendemos, tu historial de compras puede revelar
        información de esa naturaleza, así que lo tratamos como sensible aunque
        para nosotros sea simplemente un pedido.
      </p>
      <p>Lo que eso significa en la práctica:</p>
      <ul>
        <li>
          <strong>
            No estás obligado a autorizarnos el tratamiento de datos sensibles.
          </strong>{" "}
          La ley lo dice y nosotros te lo repetimos acá.
        </li>
        <li>
          No construimos perfiles de tus preferencias ni te clasificamos por lo
          que compras.
        </li>
        <li>
          No usamos tu historial de compras para publicidad, ni propia ni de
          terceros, ni lo entregamos a plataformas de anuncios.
        </li>
        <li>
          No vendemos, arrendamos ni cedemos tus datos a nadie con fines
          comerciales.
        </li>
        <li>
          El nombre de los productos no aparece en el asunto ni en la vista
          previa de ningún correo o notificación que te enviemos.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Procesar, facturar y entregar tu pedido.</li>
        <li>Coordinar contigo la entrega y responderte por WhatsApp.</li>
        <li>Atender garantías, cambios y reclamos.</li>
        <li>
          Cumplir obligaciones legales, contables y tributarias, y atender
          requerimientos de autoridades competentes.
        </li>
      </ul>
      <p>
        Cualquier uso distinto de estos requiere que nos lo autorices aparte.
      </p>

      <h2>Quién más los ve</h2>
      <p>
        Para operar la tienda nos apoyamos en proveedores que actúan como
        encargados del tratamiento y solo pueden usar tus datos para prestarnos
        su servicio: la plataforma donde vive la tienda y su base de datos, el
        servicio que aloja las imágenes del catálogo, la pasarela de pagos
        cuando pagues en línea, y la transportadora que lleva tu pedido.
      </p>
      <p>
        Algunos de esos proveedores tienen servidores fuera de Colombia,
        principalmente en Estados Unidos, de modo que tus datos se transfieren y
        almacenan allí. Al aceptar esta política autorizas esa transferencia
        internacional en los términos del artículo 26 de la Ley 1581 de 2012.
      </p>
      <p>
        La transportadora recibe únicamente lo necesario para entregarte:
        nombre, dirección y teléfono.{" "}
        <strong>No recibe el detalle de lo que compraste</strong>, y la guía no
        describe el contenido.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Conservamos los datos de un pedido mientras dure la relación comercial y
        después por el tiempo que nos exijan las normas contables y tributarias
        colombianas. Cumplido ese plazo, o cuando nos pidas la supresión y no
        exista un deber legal de conservarlos, los eliminamos.
      </p>

      <h2>Tus derechos</h2>
      <p>Como titular de tus datos puedes, en cualquier momento:</p>
      <ul>
        <li>Conocer qué datos tuyos tenemos y cómo los estamos usando.</li>
        <li>
          Actualizarlos o rectificarlos si están incompletos o equivocados.
        </li>
        <li>
          Solicitar que los suprimamos, cuando no exista un deber legal o
          contractual que nos obligue a conservarlos.
        </li>
        <li>Revocar la autorización que nos diste.</li>
        <li>Pedirnos prueba de esa autorización.</li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio por
          infracciones a la Ley 1581 de 2012.
        </li>
      </ul>

      <h2>Cómo ejercerlos</h2>
      <p>
        Escríbenos por WhatsApp diciéndonos qué necesitas y cómo identificarte.
        Los plazos que cumplimos son los que fija la ley:
      </p>
      <ul>
        <li>
          <strong>Consultas:</strong> respondemos en máximo diez (10) días
          hábiles. Si no alcanzamos, te avisamos por qué y tomamos hasta cinco
          (5) días hábiles más.
        </li>
        <li>
          <strong>Reclamos:</strong> respondemos en máximo quince (15) días
          hábiles desde que lo recibimos. Si no alcanzamos, te avisamos por qué
          y tomamos hasta ocho (8) días hábiles más.
        </li>
      </ul>
      <p>
        Si el reclamo llega incompleto, te lo decimos dentro de los cinco (5)
        días siguientes para que lo completes.
      </p>

      <h2>Menores de edad</h2>
      <p>
        Esta tienda es exclusivamente para mayores de 18 años. No dirigimos
        nuestros productos a menores ni tratamos sus datos a sabiendas. Si
        detectamos que un pedido corresponde a una persona menor de edad, lo
        cancelamos y eliminamos los datos asociados.
      </p>

      <h2>Cambios a esta política</h2>
      <p>
        Si la cambiamos, publicamos la versión nueva en esta misma página con su
        fecha de actualización. Si el cambio afecta la finalidad del
        tratamiento, te lo comunicamos antes de aplicarlo.
      </p>
    </LegalArticle>
  );
}
