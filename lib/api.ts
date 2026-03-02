function resolveApiBase(): string {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!configuredBase) {
    return '';
  }

  // Safety guard: if production is accidentally configured with localhost,
  // fall back to same-origin so deployed environments still function.
  const isLocalhostBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredBase);
  const isBrowserLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhostBase && !isBrowserLocalhost) {
    return '';
  }

  return configuredBase;
}

const API_BASE = resolveApiBase();

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: unknown }).message || 'Something went wrong')
        : `Request failed with status ${res.status}`;
    throw new Error(message);
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
}

export function removeToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Types
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "in-review" | "completed";
  priority: "low" | "medium" | "high";
  color?: string;
  position: number;
  dueDate?: string | null;
  owner: string;
  workspaceId: string;
  createdAt: string;
  updatedAt?: string;
}

export const updateProfile = async (data: { name?: string; password?: string }) => {
  const token = getToken();
  if (!token) throw new Error("No token found");
  return api<{ message: string; user: User }>('/api/auth/profile', {
    method: 'PUT',
    token,
    body: data,
  });
};

export interface AuthResponse {
  token: string;
  user: User;
}
