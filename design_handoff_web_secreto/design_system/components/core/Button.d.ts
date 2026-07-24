/**
 * Botón de acción SECRETO.
 * @startingPoint section="Componentes" subtitle="Primario vino, contorno y fantasma" viewport="700x220"
 */
export interface ButtonProps {
  /** 'primario' (vino sólido) | 'contorno' | 'fantasma' */
  variant?: 'primario' | 'contorno' | 'fantasma';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
