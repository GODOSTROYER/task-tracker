const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export const SESSION_CHANGED = 'session-changed';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }

  if (!res.ok) {
    if (res.status === 401 && token && getToken() === token) removeToken();
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message : `Request failed (${res.status}). Please try again.`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// Auth helpers
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string, user?: User): void {
  localStorage.setItem('token', token);
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function removeToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

// Types
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "in-review" | "completed";
  priority: "low" | "medium" | "high";
  position: number;
  dueDate?: string | null;
  ownerId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt?: string;
}

export const updateProfile = async (data: { name?: string; password?: string; currentPassword?: string }) => {
  const token = getToken();
  if (!token) throw new Error("No token found");
  const response = await api<{ message: string; user: User; token?: string }>('/api/auth/profile', {
    method: 'PUT',
    token,
    body: data,
  });
  setToken(response.token ?? token, response.user);
  return response;
};

export interface AuthResponse {
  token: string;
  user: User;
}
