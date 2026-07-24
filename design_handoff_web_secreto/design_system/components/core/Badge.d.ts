/** Badge/chip uppercase para promesas y estados. */
export interface BadgeProps {
  /** neutro | vino | oro | exito | error */
  tone?: 'neutro' | 'vino' | 'oro' | 'exito' | 'error';
  children: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
