const BASE = import.meta.env.VITE_API_URL || '/api';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('tg_token');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido');
  return data;
}

export const api = {
  // Auth
  login:    (email: string, password: string) =>
    req<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    req<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  me:       () => req<any>('/auth/me'),

  // Projects
  getProjects:    () => req<any[]>('/projects'),
  getProject:     (id: string) => req<any>(`/projects/${id}`),
  createProject:  (data: any) => req<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject:  (id: string, data: any) => req<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject:  (id: string) => req<any>(`/projects/${id}`, { method: 'DELETE' }),

  // Tokens
  getTokens:      (projectId?: string) => req<any[]>(`/tokens${projectId ? `?projectId=${projectId}` : ''}`),
  generateToken:  (data: any) => req<any>('/tokens/generate', { method: 'POST', body: JSON.stringify(data) }),
  revokeToken:    (jti: string) => req<any>('/tokens/revoke', { method: 'POST', body: JSON.stringify({ jti }) }),

  // Logs
  getLogs:   (params?: Record<string, string>) => req<any[]>(`/logs?${new URLSearchParams(params ?? {})}`),
  getStats:  () => req<any>('/logs/stats'),
};
