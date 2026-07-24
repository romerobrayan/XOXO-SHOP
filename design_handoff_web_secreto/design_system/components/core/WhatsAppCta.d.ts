/** CTA pill de WhatsApp — el canal de venta y asesoría de la marca. */
export interface WhatsAppCtaProps {
  children?: React.ReactNode;
  /** Número en formato internacional sin + */
  phone?: string;
  /** Mensaje precargado */
  message?: string;
}
export declare function WhatsAppCta(props: WhatsAppCtaProps): JSX.Element;
