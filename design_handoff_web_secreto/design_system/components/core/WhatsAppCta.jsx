import React from 'react';
export function WhatsAppCta({ children = 'Asesoría privada por WhatsApp →', phone = '573168667068', message = 'Hola, quiero una asesoría', style, ...rest }) {
  const href = 'https://api.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(message);
  return <a href={href} target="_blank" rel="noreferrer" style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--cobre)',
    border: '1px solid var(--oro)', borderRadius: 'var(--r-full)', padding: '12px 24px',
    background: 'transparent', textDecoration: 'none', ...style }} {...rest}>{children}</a>;
}
