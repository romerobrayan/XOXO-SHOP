import React from 'react';
export function Badge({ tone = 'neutro', children, style, ...rest }) {
  const tones = {
    neutro: { color: 'var(--texto-suave)', background: 'var(--crema)', borderColor: 'var(--linea)' },
    vino: { color: 'var(--marfil)', background: 'var(--vino)', borderColor: 'var(--vino)' },
    oro: { color: 'var(--tinta)', background: 'var(--oro)', borderColor: 'var(--oro)' },
    exito: { color: 'var(--exito)', background: 'transparent', borderColor: 'var(--exito)' },
    error: { color: 'var(--error)', background: 'transparent', borderColor: 'var(--error)' },
  };
  return <span style={{
    display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-body)', fontSize: 11,
    letterSpacing: 1, textTransform: 'uppercase', border: '1px solid', borderRadius: 'var(--r-full)',
    padding: '5px 12px', ...tones[tone], ...style }} {...rest}>{children}</span>;
}
