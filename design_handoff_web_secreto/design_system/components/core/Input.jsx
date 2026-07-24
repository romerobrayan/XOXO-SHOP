import React from 'react';
export function Input({ label, style, ...rest }) {
  const field = <input style={{
    fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--texto-titulo)',
    background: 'var(--crema)', border: '1px solid var(--linea)', borderRadius: 'var(--r-md)',
    padding: '12px 16px', outline: 'none', width: '100%', boxSizing: 'border-box', ...style }} {...rest} />;
  if (!label) return field;
  return <label style={{ display: 'block' }}>
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--texto-cuerpo)', display: 'block', marginBottom: 8 }}>{label}</span>
    {field}
  </label>;
}
