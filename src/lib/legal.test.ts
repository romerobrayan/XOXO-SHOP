import { describe, expect, it } from "vitest";

import {
  LEGAL_PAGES,
  legalPage,
  responsableLinea,
  type Responsable,
} from "./legal";

// El registro legal alimenta el footer, la navegación entre páginas y las
// páginas mismas. Estas pruebas fijan lo que no puede romperse en silencio:
// que las cuatro rutas existan y sean coherentes, y que la identificación del
// responsable NUNCA salga con un hueco visible en una página publicada —
// que es lo que pasaría si se concatenara un campo vacío sin filtrarlo.

const FILLED: Responsable = {
  nombreComercial: "SECRETO · antes XOXO",
  razonSocial: "Ejemplo S.A.S.",
  identificacion: "900123456-7",
  domicilio: "Calle 10 # 40-20",
  ciudad: "Medellín, Colombia",
  correo: "hola@ejemplo.co",
};

const EMPTY: Responsable = {
  nombreComercial: "SECRETO · antes XOXO",
  razonSocial: "",
  identificacion: "",
  domicilio: "",
  ciudad: "Medellín, Colombia",
  correo: "",
};

/**
 * La forma que realmente va a producción: identificada, pero SIN dirección.
 * La tienda es virtual y la única dirección existente es la vivienda del
 * titular, así que `LEGAL_DOMICILIO` queda vacío a propósito y la frase tiene
 * que cerrar igual de bien con la ciudad sola.
 */
const SIN_DOMICILIO: Responsable = {
  nombreComercial: "SECRETO · antes XOXO",
  razonSocial: "Nombre Apellido",
  identificacion: "900123456-7",
  domicilio: "",
  ciudad: "Medellín, Antioquia, Colombia",
  correo: "hola@ejemplo.co",
};

describe("LEGAL_PAGES", () => {
  it("declara las cuatro páginas que exige el onboarding de la pasarela", () => {
    expect(LEGAL_PAGES.map((p) => p.slug)).toEqual([
      "privacidad",
      "terminos",
      "envios",
      "devoluciones",
    ]);
  });

  it("no repite slugs ni rutas", () => {
    expect(new Set(LEGAL_PAGES.map((p) => p.slug)).size).toBe(
      LEGAL_PAGES.length,
    );
    expect(new Set(LEGAL_PAGES.map((p) => p.href)).size).toBe(
      LEGAL_PAGES.length,
    );
  });

  it("deriva cada ruta del slug, que es como están las carpetas en disco", () => {
    for (const page of LEGAL_PAGES) {
      expect(page.href).toBe(`/legal/${page.slug}`);
    }
  });

  it("da a cada página título, etiqueta de footer y descripción", () => {
    for (const page of LEGAL_PAGES) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.footerLabel.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
    }
  });
});

describe("legalPage", () => {
  it("resuelve una página por slug", () => {
    expect(legalPage("devoluciones").href).toBe("/legal/devoluciones");
  });

  it("falla ruidosamente ante un slug desconocido", () => {
    // @ts-expect-error — el tipo lo impide; la prueba cubre el caso en runtime.
    expect(() => legalPage("garantia")).toThrow(/Unknown legal page/);
  });
});

describe("responsableLinea", () => {
  it("usa la identificación completa cuando existe", () => {
    const linea = responsableLinea(FILLED);
    expect(linea).toContain("Ejemplo S.A.S.");
    expect(linea).toContain("NIT 900123456-7");
    expect(linea).toContain("Calle 10 # 40-20, Medellín, Colombia");
  });

  it("sigue siendo una frase completa sin razón social ni NIT", () => {
    expect(responsableLinea(EMPTY)).toBe(
      "SECRETO · antes XOXO, comercio con domicilio en Medellín, Colombia",
    );
  });

  it("identifica con ciudad sola cuando no hay dirección publicable", () => {
    expect(responsableLinea(SIN_DOMICILIO)).toBe(
      "SECRETO · antes XOXO (Nombre Apellido, NIT 900123456-7), con domicilio en Medellín, Antioquia, Colombia",
    );
  });

  it("nunca deja paréntesis vacíos, comas colgando ni dobles espacios", () => {
    for (const responsable of [FILLED, EMPTY, SIN_DOMICILIO]) {
      const linea = responsableLinea(responsable);
      expect(linea).not.toMatch(/\(\s*\)/);
      expect(linea).not.toMatch(/,\s*,/);
      expect(linea).not.toMatch(/\s{2}/);
      expect(linea).not.toMatch(/(^|\s)(en|de|NIT),?\s*$/);
    }
  });
});
