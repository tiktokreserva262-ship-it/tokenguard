import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  const load = (status = '') => api.getLogs(status ? { status, limit: '100' } : { limit: '100' }).then(setLogs).catch(() => {});
  useEffect(() => { load(); }, []);

  const setF = (s: string) => { setFilter(s); load(s); };

  const btn = (label: string, val: string) => (
    <button onClick={() => setF(val)} style={{ padding: '6px 14px', background: filter === val ? '#1a6fff' : 'transparent', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, color: filter === val ? '#fff' : '#8ca0c0', fontSize: 12, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', transition: 'all .15s' }}>{label}</button>
  );

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>Logs de Acesso</h1>
          <p style={{ fontSize: 12, color: '#4a6080', marginTop: 2 }}>Auditoria completa de validações — IPs mascarados</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{btn('Todos','')}{btn('Autorizados','authorized')}{btn('Bloqueados','blocked')}</div>
      </div>

      <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Timestamp','Projeto','Status','Motivo / Domínio','IP','Session ID'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#4a6080', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(30,100,200,0.18)' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid rgba(30,100,200,0.1)' }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#4a6080' }}>{new Date(l.created_at).toLocaleTimeString('pt-BR')}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{l.project_name ?? l.project_id ?? '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 600, ...(l.status === 'authorized' ? { background: 'rgba(0,229,160,0.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)' } : { background: 'rgba(255,64,96,0.1)', color: '#ff4060', border: '1px solid rgba(255,64,96,0.2)' }) }}>
                    {l.status === 'authorized' ? '✓ Autorizado' : '✕ Bloqueado'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: l.status === 'blocked' ? '#ff4060' : '#8ca0c0' }}>{l.reason ?? '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11 }}>{l.ip ?? '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#4a6080' }}>{l.session_id?.slice(0,16) ?? '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#4a6080' }}>Nenhum log ainda</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
