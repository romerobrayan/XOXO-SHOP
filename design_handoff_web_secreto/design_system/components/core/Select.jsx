import React from 'react';
export function Select({ label, options = [], style, ...rest }) {
  const field = <select style={{
    fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--texto-titulo)',
    background: 'var(--crema)', border: '1px solid var(--linea)', borderRadius: 'var(--r-md)',
    padding: '12px 16px', outline: 'none', width: '100%', boxSizing: 'border-box', ...style }} {...rest}>
    {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>;
  if (!label) return field;
  return <label style={{ display: 'block' }}>
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--texto-cuerpo)', display: 'block', marginBottom: 8 }}>{label}</span>
    {field}
  </label>;
}
