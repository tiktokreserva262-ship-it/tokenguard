import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({ authorized: 0, blocked: 0, total: 0 });
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});
    api.getLogs({ limit: '6' }).then(setLogs).catch(() => {});
  }, []);

  const card = (label: string, value: any, color: string, sub: string) => (
    <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ fontSize: 11, color: '#4a6080', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8ca0c0', marginTop: 6 }}>{sub}</div>
    </div>
  );

  return (
    <div className="animate-in">
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {card('Projetos', projects.length, '#1a6fff', 'cadastrados')}
        {card('Validações 24h', stats.total ?? 0, '#00d4ff', 'requisições')}
        {card('Autorizados', stats.authorized ?? 0, '#00e5a0', `${stats.total ? Math.round((stats.authorized/stats.total)*100) : 0}% de aprovação`)}
        {card('Bloqueados', stats.blocked ?? 0, '#ff4060', 'não autorizados')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Projetos */}
        <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30,100,200,0.18)', fontSize: 13, fontWeight: 600 }}>Projetos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nome','Domínio','Status'].map(h => <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: '#4a6080', fontFamily: 'monospace', textTransform: 'uppercase', borderBottom: '1px solid rgba(30,100,200,0.18)' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {projects.slice(0,5).map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#4a6080', fontFamily: 'monospace' }}>{p.domains?.[0]}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: p.status === 'active' ? 'rgba(0,229,160,0.1)' : 'rgba(255,176,32,0.1)', color: p.status === 'active' ? '#00e5a0' : '#ffb020', border: `1px solid ${p.status === 'active' ? 'rgba(0,229,160,0.2)' : 'rgba(255,176,32,0.2)'}`, fontFamily: 'monospace', fontWeight: 600 }}>
                      {p.status === 'active' ? '● Ativo' : '● Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan={3} style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: '#4a6080' }}>Nenhum projeto ainda</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Logs recentes */}
        <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30,100,200,0.18)', fontSize: 13, fontWeight: 600 }}>Atividade Recente</div>
          <div style={{ padding: '4px 0' }}>
            {logs.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(30,100,200,0.1)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.status === 'authorized' ? '#00e5a0' : '#ff4060', flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: '#4a6080', fontFamily: 'monospace', minWidth: 60 }}>{new Date(l.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                <div style={{ fontSize: 12, color: '#8ca0c0', flex: 1 }}>
                  <span style={{ color: '#e8f0ff', fontWeight: 500 }}>{l.project_name ?? l.project_id}</span>
                  {l.reason ? ` — ${l.reason}` : ''}
                </div>
              </div>
            ))}
            {logs.length === 0 && <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: '#4a6080' }}>Nenhum log ainda</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
