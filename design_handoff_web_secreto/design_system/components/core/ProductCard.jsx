import React from 'react';
import { Badge } from './Badge.jsx';
export function ProductCard({ kicker, name, price, note = 'Envío discreto', badge, badgeTone = 'oro', image, onClick, style }) {
  return <div onClick={onClick} style={{
    background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--r-md)',
    overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', position: 'relative', fontFamily: 'var(--font-body)', ...style }}>
    {badge && <div style={{ position: 'absolute', top: 12, left: 12 }}><Badge tone={badgeTone}>{badge}</Badge></div>}
    <div style={{ aspectRatio: '4 / 5', background: 'var(--arena)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {image ? <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--texto-tenue)' }}>foto producto</span>}
    </div>
    <div style={{ padding: 16 }}>
      {kicker && <div style={{ fontSize: 'var(--text-xs)', letterSpacing: 'var(--track-kicker)', textTransform: 'uppercase', color: 'var(--cobre)', fontWeight: 500 }}>{kicker}</div>}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--texto-titulo)', marginTop: 6 }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--vino)' }}>{price}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--texto-tenue)' }}>{note}</span>
      </div>
    </div>
  </div>;
}
