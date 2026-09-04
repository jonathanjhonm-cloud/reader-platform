const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type ApiError = { message?: string | string[] };

let refreshPromise: Promise<AuthResponse> | null = null;

function parseApiError(error: ApiError) {
  return Array.isArray(error.message) ? error.message[0] : error.message ?? 'Não foi possível concluir a solicitação.';
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as ApiError;
        throw new Error(parseApiError(error));
      }
      const result = await response.json() as AuthResponse;
      sessionStorage.setItem('accessToken', result.accessToken);
      return result;
    }).catch((cause) => {
      sessionStorage.removeItem('accessToken');
      throw cause;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const hasJsonBody = init.body != null && !isFormData;
  const send = (token: string | null) => {
    return fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };
  let token = typeof window === 'undefined' ? null : sessionStorage.getItem('accessToken');
  let response = await send(token);
  const canRefresh = typeof window !== 'undefined'
    && response.status === 401
    && !['/auth/login', '/auth/register', '/auth/refresh'].includes(path);
  if (canRefresh) {
    const currentToken = sessionStorage.getItem('accessToken');
    if (!currentToken || currentToken === token) await refreshSession();
    token = sessionStorage.getItem('accessToken');
    response = await send(token);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as ApiError;
    throw new Error(parseApiError(error));
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function requestBlob(path: string) {
  const send = (token: string | null) => {
    return fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
  let token = typeof window === 'undefined' ? null : sessionStorage.getItem('accessToken');
  let response = await send(token);
  if (typeof window !== 'undefined' && response.status === 401) {
    const currentToken = sessionStorage.getItem('accessToken');
    if (!currentToken || currentToken === token) await refreshSession();
    token = sessionStorage.getItem('accessToken');
    response = await send(token);
  }
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
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
export type ReaderHighlight = {
  id: string;
  text: string;
  color: HighlightColor;
  range: { sectionId: string; start: number; end: number };
  createdAt: string;
  annotation?: { id: string; content: string; updatedAt: string } | null;
};
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};
export type DriveFilePage = { files: DriveFile[]; nextPageToken?: string };

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  refresh: () => refreshSession(),
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
    request<{ answer: string; scope: 'selection' | 'section' | 'book' }>(`/books/${bookId}/assistant`, { method: 'POST', body: JSON.stringify(input) }),
  highlights: (bookId: string) => request<ReaderHighlight[]>(`/books/${bookId}/highlights`),
  createHighlight: (bookId: string, input: { sectionId: string; start: number; end: number; color: HighlightColor; note?: string }) =>
    request<ReaderHighlight>(`/books/${bookId}/highlights`, { method: 'POST', body: JSON.stringify(input) }),
  updateHighlight: (bookId: string, highlightId: string, input: { color?: HighlightColor; note?: string }) =>
    request<ReaderHighlight>(`/books/${bookId}/highlights/${highlightId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteHighlight: (bookId: string, highlightId: string) => request<void>(`/books/${bookId}/highlights/${highlightId}`, { method: 'DELETE' }),
  driveStatus: () => request<{ configured: boolean; connected: boolean }>('/drive/status'),
  driveFiles: (pageToken?: string) => request<DriveFilePage>(`/drive/reading-files${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`),
  importDriveFile: (fileId: string) => request<Book>(`/drive/files/${encodeURIComponent(fileId)}/import`, { method: 'POST' }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  googleUrl: `${API_URL}/auth/google`,
};
