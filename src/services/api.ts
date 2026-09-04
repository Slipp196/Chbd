import { Category, VideoQuestion, CategoryStats, User } from '../types';

const TOKEN_STORAGE_KEY = 'chbd_auth_token_v1';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error saving token', e);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Ошибка сервера (${res.status})`);
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    async register(username: string, password: string): Promise<{ user: User; token: string }> {
      const res = await request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setStoredToken(res.token);
      return res;
    },

    async login(username: string, password: string): Promise<{ user: User; token: string }> {
      const res = await request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setStoredToken(res.token);
      return res;
    },

    async getMe(): Promise<User | null> {
      const token = getStoredToken();
      if (!token) return null;
      try {
        const res = await request<{ user: User | null }>('/api/auth/me');
        return res.user;
      } catch {
        setStoredToken(null);
        return null;
      }
    },

    async logout(): Promise<void> {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        setStoredToken(null);
      }
    },
  },

  // Categories
  categories: {
    async getAll(): Promise<Category[]> {
      return request<Category[]>('/api/categories');
    },

    async create(
      data: Omit<Category, 'id' | 'authorId' | 'authorName' | 'createdAt'>
    ): Promise<Category> {
      return request<Category>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(
      id: string,
      data: Partial<Omit<Category, 'id' | 'authorId' | 'authorName' | 'createdAt'>>
    ): Promise<Category> {
      return request<Category>(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<{ success: boolean; id: string }> {
      return request<{ success: boolean; id: string }>(`/api/categories/${id}`, {
        method: 'DELETE',
      });
    },

    async sync(categories: Category[]): Promise<Category[]> {
      const res = await request<{ success: boolean; categories: Category[] }>('/api/categories/sync', {
        method: 'POST',
        body: JSON.stringify({ categories }),
      });
      return res.categories || categories;
    },
  },

  // Questions
  questions: {
    async getAll(categoryId?: string): Promise<VideoQuestion[]> {
      const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
      return request<VideoQuestion[]>(`/api/questions${query}`);
    },

    async create(
      data: Omit<VideoQuestion, 'id' | 'authorId' | 'createdAt'>
    ): Promise<VideoQuestion> {
      return request<VideoQuestion>('/api/questions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(
      id: string,
      data: Partial<Omit<VideoQuestion, 'id' | 'authorId' | 'createdAt'>>
    ): Promise<VideoQuestion> {
      return request<VideoQuestion>(`/api/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<{ success: boolean; id: string }> {
      return request<{ success: boolean; id: string }>(`/api/questions/${id}`, {
        method: 'DELETE',
      });
    },

    async sync(questions: VideoQuestion[]): Promise<VideoQuestion[]> {
      const res = await request<{ success: boolean; questions: VideoQuestion[] }>('/api/questions/sync', {
        method: 'POST',
        body: JSON.stringify({ questions }),
      });
      return res.questions || questions;
    },
  },

  async syncAll(categories: Category[], questions: VideoQuestion[]): Promise<void> {
    await request('/api/sync-all', {
      method: 'POST',
      body: JSON.stringify({ categories, questions }),
    });
  },

  // Stats
  stats: {
    async get(): Promise<Record<string, CategoryStats>> {
      return request<Record<string, CategoryStats>>('/api/stats');
    },

    async update(categoryId: string, score: number): Promise<void> {
      await request(`/api/stats/${categoryId}`, {
        method: 'POST',
        body: JSON.stringify({ score }),
      });
    },
  },
};
