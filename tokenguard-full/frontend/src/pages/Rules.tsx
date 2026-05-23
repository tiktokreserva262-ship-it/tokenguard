// Rules.tsx
export function Rules() {
  return (
    <div className="animate-in">
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Regras de Proteção</h1>
      <p style={{ fontSize: 12, color: '#4a6080', marginBottom: 24 }}>Configuradas por projeto no momento da criação</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { label: 'Assinatura JWT (HS256)', desc: 'Verificação de assinatura HMAC em toda requisição', ok: true },
          { label: 'Expiração via Redis TTL', desc: 'TTL duplo: JWT exp + chave Redis com setex', ok: true },
          { label: 'Validação de domínio', desc: 'Origin header vs allowlist do projeto', ok: true },
          { label: 'Sessão única por token', desc: 'Previne replay attacks com binding session↔jti', ok: true },
          { label: 'Limite de acessos', desc: 'Contador atômico INCR no Redis por jti', ok: true },
          { label: 'Revogação antecipada', desc: 'SET revoked:<jti> com TTL restante', ok: true },
          { label: 'Chave AES efêmera', desc: 'HKDF derivada por sessão — nunca armazenada', ok: true },
          { label: 'IP binding', desc: 'Fixar token ao IP de origem (futuro)', ok: false },
        ].map(r => (
          <div key={r.label} style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: r.ok ? 'rgba(0,229,160,0.1)' : 'rgba(74,96,128,0.2)', border: `1px solid ${r.ok ? 'rgba(0,229,160,0.3)' : 'rgba(74,96,128,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: r.ok ? '#00e5a0' : '#4a6080', flexShrink: 0, marginTop: 1 }}>
              {r.ok ? '✓' : '○'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 11, color: '#4a6080' }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sessions.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function Sessions() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { api.getLogs({ limit: '50' }).then(l => setLogs(l.filter((x:any) => x.status === 'authorized'))).catch(() => {}); }, []);
  return (
    <div className="animate-in">
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Sessões</h1>
      <p style={{ fontSize: 12, color: '#4a6080', marginBottom: 24 }}>Sessões autorizadas registradas nos logs</p>
      <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Session ID','Projeto','IP','Horário'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#4a6080', fontFamily: 'monospace', textTransform: 'uppercase', borderBottom: '1px solid rgba(30,100,200,0.18)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid rgba(30,100,200,0.1)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#00d4ff' }}>{l.session_id ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{l.project_name ?? l.project_id ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11 }}>{l.ip ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#4a6080' }}>{new Date(l.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#4a6080' }}>Nenhuma sessão ainda</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// SecureLoader.tsx
export function SecureLoader() {
  const [copied, setCopied] = useState<string>('');
  const copy = (id: string, txt: string) => { navigator.clipboard?.writeText(txt); setCopied(id); setTimeout(() => setCopied(''), 2000); };

  const loaderSnippet = `<script
  src="https://cdn.tokenguard.io/loader.js"
  data-project="proj_SEU_ID"
  data-api="https://api.tokenguard.io"
></script>`;

  return (
    <div className="animate-in">
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Secure Loader</h1>
      <p style={{ fontSize: 12, color: '#4a6080', marginBottom: 24 }}>Cole no &lt;head&gt; do seu index.html para ativar a proteção runtime</p>
      <div style={{ background: '#0d1420', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(30,100,200,0.18)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {['#ff5f57','#ffbd2e','#28c940'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8ca0c0', marginLeft: 4 }}>index.html — snippet de integração</span>
          <button onClick={() => copy('snippet', loaderSnippet)} style={{ marginLeft: 'auto', padding: '3px 10px', background: 'transparent', border: '1px solid rgba(30,100,200,0.18)', borderRadius: 6, fontSize: 11, color: '#8ca0c0', cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif' }}>{copied === 'snippet' ? '✓ Copiado' : 'Copiar'}</button>
        </div>
        <pre style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: '#00d4ff', overflowX: 'auto', lineHeight: 1.7 }}>{loaderSnippet}</pre>
      </div>
      <div style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#8ca0c0' }}>
        <span style={{ color: '#00e5a0', fontWeight: 600 }}>Como funciona:</span> O loader.js é o único script público. Ele chama <code style={{ fontFamily: 'monospace', color: '#00d4ff' }}>/generate-token</code> → <code style={{ fontFamily: 'monospace', color: '#00d4ff' }}>/validate</code> → descriptografa o bundle AES-GCM em memória → injeta o app no DOM. Sem autorização, tela de bloqueio.
      </div>
    </div>
  );
}

export default Rules;
