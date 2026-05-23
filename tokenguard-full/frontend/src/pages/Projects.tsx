import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', expiry: '3600' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.getProjects().then(setProjects).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.domain) return setError('Nome e domínio obrigatórios');
    setLoading(true); setError('');
    try {
      await api.createProject({ name: form.name, domains: [form.domain], rules: { tokenExpiry: Number(form.expiry) } });
      setShowModal(false); setForm({ name: '', domain: '', expiry: '3600' }); load();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Remover projeto?')) return;
    await api.deleteProject(id).catch(() => {});
    load();
  };

  const inp: React.CSSProperties = { width: '100%', background: '#111927', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8f0ff', fontFamily: 'Space Grotesk,sans-serif', outline: 'none', marginTop: 6 };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>Projetos</h1>
          <p style={{ fontSize: 12, color: '#4a6080', marginTop: 2 }}>Frontends protegidos pelo TokenGuard</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a6fff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>
          + Novo Projeto
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {projects.map(p => (
          <div key={p.id} style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden', transition: 'border-color .2s', cursor: 'default' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: '#00e5a0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,229,160,0.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)', fontFamily: 'monospace', fontWeight: 600 }}>Protegido</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a6080', fontFamily: 'monospace', marginBottom: 14 }}>{p.domains?.[0]}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: p.status === 'active' ? 'rgba(26,111,255,0.12)' : 'rgba(255,176,32,0.1)', color: p.status === 'active' ? '#2d85ff' : '#ffb020', border: `1px solid ${p.status === 'active' ? 'rgba(30,100,200,0.32)' : 'rgba(255,176,32,0.2)'}`, fontFamily: 'monospace', fontWeight: 600 }}>
                {p.status === 'active' ? '● Ativo' : '● Inativo'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid rgba(30,100,200,0.18)', paddingTop: 14 }}>
              {[['Tokens', p.active_tokens ?? 0, '#00d4ff'], ['Logs', p.total_logs ?? 0, '#00e5a0']].map(([l, v, c]: any) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#4a6080' }}>{l}</div>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={() => del(p.id)} style={{ padding: '4px 10px', background: 'rgba(255,64,96,0.1)', border: '1px solid rgba(255,64,96,0.3)', borderRadius: 6, color: '#ff4060', fontSize: 11, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>Remover</button>
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: '#4a6080', fontSize: 14 }}>
            Nenhum projeto ainda. Crie o primeiro!
          </div>
        )}
      </div>

      {showModal && (
        <div onClick={e => e.target === e.currentTarget && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.32)', borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Novo Projeto</div>
            <div style={{ fontSize: 13, color: '#8ca0c0', marginBottom: 20 }}>Configure a proteção do seu frontend</div>
            <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Nome</label><input style={inp} placeholder="Meu App" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Domínio</label><input style={inp} placeholder="app.meusite.com" value={form.domain} onChange={e => setForm(f => ({...f, domain: e.target.value}))} /></div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Expiração do token</label>
              <select style={{...inp, appearance: 'none'}} value={form.expiry} onChange={e => setForm(f => ({...f, expiry: e.target.value}))}>
                <option value="1800">30 minutos</option>
                <option value="3600">1 hora</option>
                <option value="86400">24 horas</option>
              </select>
            </div>
            {error && <div style={{ fontSize: 12, color: '#ff4060', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, color: '#8ca0c0', fontSize: 13, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>Cancelar</button>
              <button onClick={create} disabled={loading} style={{ padding: '8px 16px', background: '#1a6fff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', opacity: loading ? 0.7 : 1 }}>{loading ? 'Criando...' : 'Criar Projeto'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
