const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('accessToken');
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
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

async function requestBlob(path: string) {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('accessToken');
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Capa indisponível');
  return response.blob();
}

export type AuthResponse = { accessToken: string; user: { id: string; email: string } };
export type UserProfile = { id: string; email: string; name?: string | null };
export type Book = {
  id: string;
  title: string;
  author?: string | null;
  fileType: string;
  coverUrl?: string | null;
  coverMimeType?: string | null;
  processingStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  processingError?: string | null;
  wordCount: number;
  contentReviewedByAi: boolean;
  removedSectionCount: number;
  progress?: { location?: string; percentage: number } | null;
  updatedAt: string;
};
export type BookSection = { id: string; position: number; title?: string | null; content: string; wordCount: number };
export type BookContent = Pick<Book, 'id' | 'title' | 'author' | 'fileType' | 'processingStatus' | 'processingError' | 'wordCount' | 'progress' | 'contentReviewedByAi' | 'removedSectionCount'> & { sections: BookSection[] };

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),
  me: () => request<UserProfile>('/auth/me'),
  books: () => request<Book[]>('/books'),
  bookContent: (bookId: string) => request<BookContent>(`/books/${bookId}/content`),
  bookCover: (bookId: string) => requestBlob(`/books/${bookId}/cover`),
  refreshBookCover: (bookId: string) => request<{ available: boolean; coverUrl?: string | null }>(`/books/${bookId}/cover/refresh`, { method: 'POST' }),
  deleteBook: (bookId: string) => request<void>(`/books/${bookId}`, { method: 'DELETE' }),
  uploadBook: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<Book>('/books/upload', { method: 'POST', body });
  },
  updateProgress: (bookId: string, location: string, percentage: number) => request(`/books/${bookId}/progress`, {
    method: 'PATCH', body: JSON.stringify({ location, percentage }),
  }),
  askAssistant: (bookId: string, input: { action: 'summarize' | 'explain' | 'context' | 'question'; selectedText?: string; question?: string; sectionId?: string }) =>
    request<{ answer: string }>(`/books/${bookId}/assistant`, { method: 'POST', body: JSON.stringify(input) }),
  driveStatus: () => request<{ configured: boolean; connected: boolean }>('/drive/status'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  googleUrl: `${API_URL}/auth/google`,
};
