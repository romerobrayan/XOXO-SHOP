/**
 * Tarjeta de producto del catálogo.
 * @startingPoint section="Componentes" subtitle="Media 4:5, kicker cobre, precio vino" viewport="300x420"
 */
export interface ProductCardProps {
  /** Categoría uppercase, ej. "Bienestar · Top ventas" */
  kicker?: string;
  name: string;
  /** Precio ya formateado, ej. "$120.000" */
  price: string;
  /** Nota junto al precio. Default: "Envío discreto" */
  note?: string;
  /** Badge flotante sobre la imagen, ej. "Nuevo" */
  badge?: string;
  badgeTone?: 'neutro' | 'vino' | 'oro' | 'exito' | 'error';
  /** URL de la foto; sin ella muestra placeholder */
  image?: string;
  onClick?: () => void;
}
export declare function ProductCard(props: ProductCardProps): JSX.Element;
