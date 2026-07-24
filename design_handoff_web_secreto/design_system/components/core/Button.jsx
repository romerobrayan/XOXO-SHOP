import React from 'react';
export function Button({ variant = 'primario', size = 'md', disabled = false, children, style, ...rest }) {
  const pad = size === 'sm' ? '10px 20px' : size === 'lg' ? '18px 36px' : '14px 28px';
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--text-sm)',
    letterSpacing: 'var(--track-boton)', textTransform: 'uppercase', padding: pad,
    borderRadius: 'var(--r-sm)', border: '1px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1, transition: 'background .15s ease, color .15s ease',
  };
  const variants = {
    primario: { background: 'var(--vino)', color: 'var(--marfil)' },
    contorno: { background: 'transparent', color: 'var(--vino)', borderColor: 'var(--vino)' },
    fantasma: { background: 'transparent', color: 'var(--texto-cuerpo)' },
  };
  return <button disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...rest}>{children}</button>;
}
