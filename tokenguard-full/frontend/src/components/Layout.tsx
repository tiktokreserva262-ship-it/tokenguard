import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const nav = [
  { to: '/',         icon: '⊞', label: 'Dashboard' },
  { to: '/projects', icon: '◫', label: 'Projetos' },
  { to: '/tokens',   icon: '⌗', label: 'Tokens' },
  { to: '/rules',    icon: '⛨', label: 'Regras' },
  { to: '/loader',   icon: '⟨⟩', label: 'Secure Loader' },
  { to: '/logs',     icon: '≡',  label: 'Logs' },
  { to: '/sessions', icon: '◷',  label: 'Sessões' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100vh' }}>
      {/* SIDEBAR */}
      <aside style={{ background: '#0d1420', borderRight: '1px solid rgba(30,100,200,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(30,100,200,0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#1a6fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>TG</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>TokenGuard</div>
            <div style={{ fontSize: 10, color: '#4a6080', fontFamily: 'monospace' }}>Runtime Protection</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                fontSize: 13, fontWeight: 500,
                color: isActive ? '#2d85ff' : '#8ca0c0',
                background: isActive ? 'rgba(26,111,255,0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(30,100,200,0.32)' : 'transparent'}`,
                transition: 'all .15s',
              })}>
              <span>{icon}</span>{label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(30,100,200,0.18)' }}>
          <div style={{ background: '#111927', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1a6fff,#00d4ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email ?? 'User'}</div>
              <div style={{ fontSize: 10, color: '#4a6080' }}>Pro</div>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#4a6080', cursor: 'pointer', fontSize: 16 }} title="Sair">⏻</button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
