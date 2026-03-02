const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

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

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
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
