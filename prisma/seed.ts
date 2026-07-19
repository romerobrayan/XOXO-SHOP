// Demo catalog for the Phase 0 design review — real XoXo products at real
// prices, not lorem ipsum. Covers all three families so every picker state
// (two axes, one axis, zero axes) exists in the database.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeOptionKey } from "../src/features/catalog/optionKey";
import { slugify } from "../src/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  // Wipe in dependency order — seed is only ever run against dev databases.
  await db.variantOptionValue.deleteMany();
  await db.productVariant.deleteMany();
  await db.productOptionValue.deleteMany();
  await db.productOption.deleteMany();
  await db.productSpec.deleteMany();
  await db.productImage.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.brand.deleteMany();

  const [lovense, senIntimo, prettyLove] = await Promise.all(
    ["Lovense", "Sen Intimo", "Pretty Love"].map((name) =>
      db.brand.create({ data: { name, slug: slugify(name) } }),
    ),
  );

  const [lenceria, cosmetica, jugueteria] = await Promise.all(
    ["Lencería", "Cosmética íntima", "Juguetería y dispositivos"].map(
      (name, position) =>
        db.category.create({ data: { name, slug: slugify(name), position } }),
    ),
  );

  // ── Two axes: Conjunto Tiras — Talla × Color ─────────────────────────────
  const conjunto = await db.product.create({
    data: {
      name: "Conjunto Tiras",
      slug: "conjunto-tiras",
      status: "ACTIVE",
      publishedAt: new Date(),
      supplierRef: "11362",
      categoryId: lenceria.id,
      minPriceCents: 45_000_00,
      description:
        "Conjunto de dos piezas en tiras elásticas ajustables. Tejido suave con elastano. Lavar a mano con agua fría.",
      options: {
        create: [
          {
            name: "Talla",
            position: 0,
            values: {
              create: ["S", "M", "L", "XL"].map((value, position) => ({
                value,
                position,
              })),
            },
          },
          {
            name: "Color",
            position: 1,
            values: {
              create: [
                { value: "Negro", hex: "#1A1A1A", position: 0 },
                { value: "Rojo", hex: "#C0182B", position: 1 },
              ],
            },
          },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });

  const conjuntoValues = new Map(
    conjunto.options.flatMap((o) =>
      o.values.map((v) => [`${o.name}:${v.value}`, v.id] as const),
    ),
  );

  // The variant space is a proper subset of the Cartesian product: the store
  // stocks 5 of the 8 combinations, and one of those is sold out — so the
  // picker's "disabled and visible" state is reviewable with real data.
  const conjuntoStock: Array<[string, string, number]> = [
    ["S", "Negro", 4],
    ["M", "Negro", 6],
    ["L", "Negro", 0],
    ["XL", "Negro", 2],
    ["M", "Rojo", 3],
  ];
  for (const [talla, color, stockOnHand] of conjuntoStock) {
    const valueIds = [
      conjuntoValues.get(`Talla:${talla}`)!,
      conjuntoValues.get(`Color:${color}`)!,
    ];
    await db.productVariant.create({
      data: {
        productId: conjunto.id,
        sku: `11362-${talla}-${color.toUpperCase()}`,
        priceCents: 45_000_00,
        stockOnHand,
        optionKey: computeOptionKey(valueIds),
        optionValues: {
          create: valueIds.map((optionValueId) => ({ optionValueId })),
        },
      },
    });
  }

  // ── One axis: Sen Intimo Desensibilizante — Presentación ─────────────────
  const desensibilizante = await db.product.create({
    data: {
      name: "Sen Intimo Desensibilizante",
      slug: "sen-intimo-desensibilizante",
      status: "ACTIVE",
      publishedAt: new Date(),
      brandId: senIntimo.id,
      categoryId: cosmetica.id,
      minPriceCents: 45_000_00,
      description:
        "Gel desensibilizante de uso externo. Aplicar la cantidad indicada y esperar unos minutos antes del contacto. No contiene fragancia.",
      options: {
        create: [
          {
            name: "Presentación",
            position: 0,
            values: {
              create: [
                { value: "30 ml", position: 0 },
                { value: "130 ml", position: 1 },
              ],
            },
          },
        ],
      },
      specs: {
        create: [
          { label: "Uso", value: "Externo", position: 0 },
          { label: "Base", value: "Agua", position: 1 },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });

  const presentaciones = new Map(
    desensibilizante.options[0].values.map((v) => [v.value, v.id] as const),
  );
  const presentacionPrecios: Array<[string, number, number]> = [
    ["30 ml", 45_000_00, 8],
    ["130 ml", 80_000_00, 5],
  ];
  for (const [presentacion, priceCents, stockOnHand] of presentacionPrecios) {
    const valueIds = [presentaciones.get(presentacion)!];
    await db.productVariant.create({
      data: {
        productId: desensibilizante.id,
        sku: `SEN-DES-${presentacion.replace(/\s/g, "").toUpperCase()}`,
        priceCents,
        stockOnHand,
        optionKey: computeOptionKey(valueIds),
        optionValues: {
          create: valueIds.map((optionValueId) => ({ optionValueId })),
        },
      },
    });
  }

  // ── Zero axes: Lovense Lush — single SKU, exactly one variant ────────────
  await db.product.create({
    data: {
      name: "Lovense Lush 3",
      slug: "lovense-lush-3",
      status: "ACTIVE",
      publishedAt: new Date(),
      brandId: lovense.id,
      categoryId: jugueteria.id,
      minPriceCents: 120_000_00,
      description:
        "Dispositivo controlado por aplicación vía Bluetooth. Batería recargable por USB con hasta 5 horas de uso continuo. Lavar con agua tibia y jabón neutro antes y después de cada uso.",
      specs: {
        create: [
          { label: "Material", value: "Silicona médica", position: 0 },
          { label: "Conectividad", value: "Bluetooth", position: 1 },
          { label: "Batería", value: "Recargable USB", position: 2 },
          { label: "Resistente al agua", value: "Sí (IPX7)", position: 3 },
        ],
      },
      variants: {
        create: [
          {
            sku: "LOV-LUSH3",
            priceCents: 120_000_00,
            stockOnHand: 3,
            optionKey: computeOptionKey([]),
          },
        ],
      },
    },
  });

  // ── One axis (color, with swatches): Pretty Love huevo vibrador ──────────
  const huevo = await db.product.create({
    data: {
      name: "Pretty Love Huevo Vibrador",
      slug: "pretty-love-huevo-vibrador",
      status: "ACTIVE",
      publishedAt: new Date(),
      brandId: prettyLove.id,
      categoryId: jugueteria.id,
      minPriceCents: 60_000_00,
      description:
        "Huevo vibrador con control remoto inalámbrico. 12 modos de vibración. Incluye batería. Material libre de ftalatos.",
      options: {
        create: [
          {
            name: "Color",
            position: 0,
            values: {
              create: [
                { value: "Rosa", hex: "#E86FA8", position: 0 },
                { value: "Morado", hex: "#7C4FA8", position: 1 },
              ],
            },
          },
        ],
      },
      specs: {
        create: [
          { label: "Material", value: "Silicona", position: 0 },
          { label: "Modos", value: "12 vibraciones", position: 1 },
        ],
      },
    },
    include: { options: { include: { values: true } } },
  });

  for (const value of huevo.options[0].values) {
    const valueIds = [value.id];
    await db.productVariant.create({
      data: {
        productId: huevo.id,
        sku: `PL-HUEVO-${value.value.toUpperCase()}`,
        priceCents: 60_000_00,
        stockOnHand: value.value === "Morado" ? 0 : 6,
        optionKey: computeOptionKey(valueIds),
        optionValues: {
          create: valueIds.map((optionValueId) => ({ optionValueId })),
        },
      },
    });
  }

  const counts = {
    brands: await db.brand.count(),
    categories: await db.category.count(),
    products: await db.product.count(),
    variants: await db.productVariant.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
