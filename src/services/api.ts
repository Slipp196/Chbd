import { Category, VideoQuestion, CategoryStats, User } from '../types';

const TOKEN_STORAGE_KEY = 'chbd_auth_token_v1';
const USER_STORAGE_KEY = 'chbd_cached_user_v1';

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

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error saving user cache', e);
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
    const error: any = new Error(data.error || `Ошибка сервера (${res.status})`);
    error.status = res.status;
    throw error;
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
      setStoredUser(res.user);
      return res;
    },

    async login(username: string, password: string): Promise<{ user: User; token: string }> {
      const res = await request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setStoredToken(res.token);
      setStoredUser(res.user);
      return res;
    },

    async loginWithTwitch(twitchLogin: string): Promise<{ user: User; token: string }> {
      const res = await request<{ user: User; token: string }>('/api/auth/twitch', {
        method: 'POST',
        body: JSON.stringify({ twitchLogin }),
      });
      setStoredToken(res.token);
      setStoredUser(res.user);
      return res;
    },

    async getMe(): Promise<User | null> {
      const token = getStoredToken();
      if (!token) {
        setStoredUser(null);
        return null;
      }
      try {
        const res = await request<{ user: User | null }>('/api/auth/me');
        if (res.user) {
          setStoredUser(res.user);
          return res.user;
        } else {
          setStoredUser(null);
          return null;
        }
      } catch (err: any) {
        // Only invalidate session if server explicitly returned 401 Unauthorized
        if (err?.status === 401) {
          setStoredToken(null);
          setStoredUser(null);
          return null;
        }
        // If server is restarting or network hiccup, fallback to cached user
        return getStoredUser();
      }
    },

    async logout(): Promise<void> {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        setStoredToken(null);
        setStoredUser(null);
      }
    },
  },

  // User Profile
  user: {
    async updateProfile(updates: { avatarUrl?: string; bannerUrl?: string; bio?: string }): Promise<User> {
      const res = await request<{ user: User }>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (res.user) {
        setStoredUser(res.user);
      }
      return res.user;
    },
  },

  // Media upload to server (persists across friends and browsers)
  media: {
    async uploadVideo(blobOrFile: Blob | File, filename: string = 'video.mp4'): Promise<{ url: string; filename: string }> {
      const token = getStoredToken();
      const headers: Record<string, string> = {
        'x-filename': encodeURIComponent(filename),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/upload-video', {
        method: 'POST',
        headers,
        body: blobOrFile,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при загрузке видеофайла');
      }
      return data;
    },
  },

  // Twitch
  twitch: {
    async resolve(url: string): Promise<{ mp4Url: string; title: string }> {
      return request<{ mp4Url: string; title: string }>(`/api/twitch/resolve?url=${encodeURIComponent(url)}`);
    },
  },

  // Categories
  categories: {
    async getAll(viewMode: 'admin' | 'user_preview' = 'admin'): Promise<Category[]> {
      return request<Category[]>(`/api/categories?viewMode=${viewMode}`);
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

    async delete(id: string): Promise<{ success: boolean; id: string; status?: string }> {
      return request<{ success: boolean; id: string; status?: string }>(`/api/categories/${id}`, {
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

  // File uploads
  upload: {
    async image(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const res = await fetch('/api/upload-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                data: base64Data,
                filename: file.name,
              }),
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || 'Ошибка загрузки изображения');
            }
            const data = await res.json();
            resolve(data.url);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения'));
        reader.readAsDataURL(file);
      });
    },
  },
};
