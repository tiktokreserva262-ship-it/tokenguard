import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const s = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      if (tab === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', background: '#111927', border: '1px solid rgba(30,100,200,0.18)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#e8f0ff',
    fontFamily: 'Space Grotesk, sans-serif', outline: 'none', marginTop: 6,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080c14' }}>
      <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.32)', borderRadius: 20, padding: 40, width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#1a6fff', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, fontFamily: 'monospace', marginBottom: 12 }}>TG</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em' }}>TokenGuard</div>
          <div style={{ fontSize: 13, color: '#4a6080', marginTop: 4 }}>Runtime Protection System</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#111927', borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif', transition: 'all .15s', background: tab === t ? '#0d1420' : 'transparent', color: tab === t ? '#e8f0ff' : '#8ca0c0' }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {tab === 'register' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Nome</label>
            <input style={inp} placeholder="Seu nome" value={form.name} onChange={s('name')} />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Email</label>
          <input style={inp} type="email" placeholder="dev@empresa.com" value={form.email} onChange={s('email')} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#8ca0c0', fontWeight: 500 }}>Senha</label>
          <input style={inp} type="password" placeholder="••••••••" value={form.password} onChange={s('password')}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {error && <div style={{ background: 'rgba(255,64,96,0.1)', border: '1px solid rgba(255,64,96,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#ff4060', marginBottom: 16 }}>{error}</div>}

        <button onClick={submit} disabled={loading}
          style={{ width: '100%', padding: 11, background: '#1a6fff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'Space Grotesk, sans-serif' }}>
          {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar no Dashboard' : 'Criar Conta'}
        </button>
      </div>
    </div>
  );
}
