import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Tokens() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ projectId: '', expiry: '3600', maxAccess: '100' });
  const [generated, setGenerated] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    api.getTokens().then(setTokens).catch(() => {});
    api.getProjects().then(p => { setProjects(p); if(p.length) setForm(f => ({...f, projectId: p[0].id})); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await api.generateToken({ projectId: form.projectId, overrides: { tokenExpiry: Number(form.expiry), maxAccess: Number(form.maxAccess) } });
      setGenerated(data.token);
      load();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const revoke = async (jti: string) => {
    if (!confirm('Revogar token?')) return;
    await api.revokeToken(jti).catch(() => {});
    load();
  };

  const copy = (txt: string) => {
    navigator.clipboard?.writeText(txt);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const statusStyle: Record<string, React.CSSProperties> = {
    valid:   { background: 'rgba(0,229,160,0.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)' },
    revoked: { background: 'rgba(74,96,128,0.2)', color: '#4a6080', border: '1px solid rgba(74,96,128,0.2)' },
    expired: { background: 'rgba(255,64,96,0.1)', color: '#ff4060', border: '1px solid rgba(255,64,96,0.2)' },
  };

  const inp: React.CSSProperties = { width: '100%', background: '#111927', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8f0ff', fontFamily: 'Space Grotesk,sans-serif', outline: 'none', marginTop: 6 };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>Tokens</h1>
          <p style={{ fontSize: 12, color: '#4a6080', marginTop: 2 }}>JWT temporários com expiração via Redis TTL</p>
        </div>
        <button onClick={() => { setGenerated(''); setShowModal(true); }} style={{ padding: '8px 16px', background: '#1a6fff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>+ Gerar Token</button>
      </div>

      <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Token ID','Projeto','Expira em','Acessos','Status','Ações'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#4a6080', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(30,100,200,0.18)' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {tokens.map(t => (
              <tr key={t.jti}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#00d4ff' }}>{t.jti}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{projects.find(p=>p.id===t.project_id)?.name ?? t.project_id}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#ffb020' }}>{new Date(t.expires_at).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>{t.rules?.maxAccess ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 600, ...(statusStyle[t.status] ?? statusStyle.expired) }}>{t.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {t.status === 'valid' && <button onClick={() => revoke(t.jti)} style={{ padding: '4px 10px', background: 'rgba(255,64,96,0.1)', border: '1px solid rgba(255,64,96,0.3)', borderRadius: 6, color: '#ff4060', fontSize: 11, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>Revogar</button>}
                </td>
              </tr>
            ))}
            {tokens.length === 0 && <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#4a6080' }}>Nenhum token ainda</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.32)', borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Gerar Token</div>
            <div style={{ fontSize: 13, color: '#8ca0c0', marginBottom: 20 }}>JWT assinado com TTL automático via Redis</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Projeto</label>
              <select style={{...inp, appearance: 'none'}} value={form.projectId} onChange={e => setForm(f => ({...f, projectId: e.target.value}))}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Expiração</label>
                <select style={{...inp, appearance: 'none'}} value={form.expiry} onChange={e => setForm(f => ({...f, expiry: e.target.value}))}>
                  <option value="1800">30 min</option><option value="3600">1 hora</option><option value="86400">24h</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Máx. acessos</label>
                <input style={inp} type="number" value={form.maxAccess} onChange={e => setForm(f => ({...f, maxAccess: e.target.value}))} />
              </div>
            </div>
            {generated && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#8ca0c0', marginBottom: 6 }}>Token gerado:</div>
                <div style={{ background: '#080c14', border: '1px solid rgba(30,100,200,0.32)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 10, color: '#00d4ff', wordBreak: 'break-all', lineHeight: 1.6, position: 'relative' }}>
                  {generated}
                  <button onClick={() => copy(generated)} style={{ position: 'absolute', top: 6, right: 6, background: '#111927', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#8ca0c0', cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>
                    {copied ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, color: '#8ca0c0', fontSize: 13, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>Fechar</button>
              <button onClick={generate} disabled={loading || !form.projectId} style={{ padding: '8px 16px', background: '#1a6fff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', opacity: loading ? 0.7 : 1 }}>{loading ? 'Gerando...' : 'Gerar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
