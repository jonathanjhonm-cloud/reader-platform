const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('accessToken');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError;
    throw new Error(Array.isArray(error.message) ? error.message[0] : error.message ?? 'Não foi possível concluir a solicitação.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export type AuthResponse = { accessToken: string; user: { id: string; email: string } };
export type Book = { id: string; title: string; author?: string | null; fileType: string; coverUrl?: string | null; progress?: { percentage: number } | null; updatedAt: string };

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),
  books: () => request<Book[]>('/books'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  googleUrl: `${API_URL}/auth/google`,
};
