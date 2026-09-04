import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Category, VideoQuestion, CategoryStats, User } from '../src/types';

interface StoredUser {
  id: string;
  username: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  sessions: StoredSession[];
  categories: Category[];
  questions: VideoQuestion[];
  stats: Record<string, CategoryStats>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Default initial categories and questions if database is clean (empty for clean user start)
const INITIAL_CATEGORIES: Category[] = [];
const INITIAL_QUESTIONS: VideoQuestion[] = [];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadData();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse db.json, initializing defaults:', err);
      }
    }

    const initial: DatabaseSchema = {
      users: [],
      sessions: [],
      categories: INITIAL_CATEGORIES,
      questions: INITIAL_QUESTIONS,
      stats: {},
    };

    this.saveData(initial);
    return initial;
  }

  private saveData(data: DatabaseSchema = this.data) {
    try {
      this.ensureDataDirectory();
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  // --- Auth & Users ---
  public hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  public registerUser(username: string, password: string): { user: User; token: string } {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new Error('Имя пользователя должно содержать не менее 2 символов');
    }
    if (!password || password.length < 4) {
      throw new Error('Пароль должен быть не менее 4 символов');
    }

    const existing = this.data.users.find(
      (u) => u.username.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      throw new Error('Пользователь с таким никнеймом уже существует');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const storedUser: StoredUser = {
      id,
      username: trimmed,
      salt,
      passwordHash,
      createdAt: Date.now(),
    };

    this.data.users.push(storedUser);

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions.push({
      token,
      userId: id,
      createdAt: Date.now(),
    });

    this.saveData();

    return {
      user: { id, username: trimmed, createdAt: storedUser.createdAt },
      token,
    };
  }

  public loginUser(username: string, password: string): { user: User; token: string } {
    const trimmed = username.trim();
    const user = this.data.users.find(
      (u) => u.username.toLowerCase() === trimmed.toLowerCase()
    );
    if (!user) {
      throw new Error('Неверный никнейм или пароль');
    }

    const hash = this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('Неверный никнейм или пароль');
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions.push({
      token,
      userId: user.id,
      createdAt: Date.now(),
    });

    this.saveData();

    return {
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
      token,
    };
  }

  public getUserByToken(token: string): User | null {
    if (!token) return null;
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return null;

    const user = this.data.users.find((u) => u.id === session.userId);
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    };
  }

  public logoutUser(token: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.saveData();
  }

  // --- Categories ---
  public getCategories(): Category[] {
    return this.data.categories;
  }

  public getCategoryById(id: string): Category | undefined {
    return this.data.categories.find((c) => c.id === id);
  }

  public createCategory(
    categoryData: Omit<Category, 'id' | 'authorId' | 'authorName' | 'createdAt'> & {
      id?: string;
      authorId?: string | null;
      authorName?: string;
      createdAt?: number;
    },
    user?: User | null
  ): Category {
    const newCategory: Category = {
      ...categoryData,
      id: categoryData.id || `cat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      authorId: user?.id || categoryData.authorId || null,
      authorName: user?.username || categoryData.authorName || 'Автор',
      createdAt: categoryData.createdAt || Date.now(),
    };

    const existingIndex = this.data.categories.findIndex((c) => c.id === newCategory.id);
    if (existingIndex >= 0) {
      this.data.categories[existingIndex] = { ...this.data.categories[existingIndex], ...newCategory };
    } else {
      this.data.categories.unshift(newCategory);
    }
    this.saveData();
    return newCategory;
  }

  public updateCategory(
    id: string,
    updates: Partial<Omit<Category, 'id' | 'authorId' | 'authorName' | 'createdAt'>>,
    user?: User | null
  ): Category {
    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Категория не найдена');
    }

    const category = this.data.categories[index];

    // Ownership check: only block if category has authorId AND current user has different authorId
    if (category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор может редактировать эту тему');
    }

    const updated: Category = {
      ...category,
      ...updates,
      id: category.id,
      authorId: category.authorId || user?.id || null,
      authorName: category.authorName || user?.username || 'Автор',
    };

    this.data.categories[index] = updated;
    this.saveData();
    return updated;
  }

  public deleteCategory(id: string, user?: User | null): void {
    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return;
    }

    const category = this.data.categories[index];
    if (category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор может удалить эту тему');
    }

    // Remove category
    this.data.categories.splice(index, 1);
    // Remove related questions
    this.data.questions = this.data.questions.filter((q) => q.categoryId !== id);
    this.saveData();
  }

  public syncCategories(categories: Category[]): Category[] {
    if (!Array.isArray(categories)) return this.data.categories;
    for (const cat of categories) {
      const idx = this.data.categories.findIndex((c) => c.id === cat.id);
      if (idx >= 0) {
        this.data.categories[idx] = { ...this.data.categories[idx], ...cat };
      } else {
        this.data.categories.push(cat);
      }
    }
    this.saveData();
    return this.data.categories;
  }

  public setCategories(categories: Category[]): Category[] {
    this.data.categories = Array.isArray(categories) ? [...categories] : [];
    this.saveData();
    return this.data.categories;
  }

  // --- Questions ---
  public getQuestions(categoryId?: string): VideoQuestion[] {
    if (categoryId) {
      return this.data.questions.filter((q) => q.categoryId === categoryId);
    }
    return this.data.questions;
  }

  public createQuestion(
    questionData: Omit<VideoQuestion, 'id' | 'authorId' | 'createdAt'> & {
      id?: string;
      authorId?: string | null;
      createdAt?: number;
    },
    user?: User | null
  ): VideoQuestion {
    const newQuestion: VideoQuestion = {
      ...questionData,
      id: questionData.id || `q_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      authorId: user?.id || questionData.authorId || null,
      createdAt: questionData.createdAt || Date.now(),
    };

    const existingIndex = this.data.questions.findIndex((q) => q.id === newQuestion.id);
    if (existingIndex >= 0) {
      this.data.questions[existingIndex] = { ...this.data.questions[existingIndex], ...newQuestion };
    } else {
      this.data.questions.push(newQuestion);
    }
    this.saveData();
    return newQuestion;
  }

  public updateQuestion(
    id: string,
    updates: Partial<Omit<VideoQuestion, 'id' | 'authorId' | 'createdAt'>>,
    user?: User | null
  ): VideoQuestion {
    const index = this.data.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      throw new Error('Вопрос не найден');
    }

    const question = this.data.questions[index];
    const category = this.getCategoryById(question.categoryId);

    if (category && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор темы может редактировать клипы');
    }

    const updated: VideoQuestion = {
      ...question,
      ...updates,
      id: question.id,
      authorId: question.authorId || user?.id || null,
    };

    this.data.questions[index] = updated;
    this.saveData();
    return updated;
  }

  public deleteQuestion(id: string, user?: User | null): void {
    const index = this.data.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      return;
    }

    const question = this.data.questions[index];
    const category = this.getCategoryById(question.categoryId);

    if (category && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор темы может удалять клипы');
    }

    this.data.questions.splice(index, 1);
    this.saveData();
  }

  public syncQuestions(questions: VideoQuestion[]): VideoQuestion[] {
    if (!Array.isArray(questions)) return this.data.questions;
    for (const q of questions) {
      const idx = this.data.questions.findIndex((item) => item.id === q.id);
      if (idx >= 0) {
        this.data.questions[idx] = { ...this.data.questions[idx], ...q };
      } else {
        this.data.questions.push(q);
      }
    }
    this.saveData();
    return this.data.questions;
  }

  public setQuestions(questions: VideoQuestion[]): VideoQuestion[] {
    this.data.questions = Array.isArray(questions) ? [...questions] : [];
    this.saveData();
    return this.data.questions;
  }

  // --- Stats ---
  public getStats(): Record<string, CategoryStats> {
    return this.data.stats || {};
  }

  public updateStats(categoryId: string, score: number): void {
    if (!this.data.stats) {
      this.data.stats = {};
    }
    const current = this.data.stats[categoryId] || {
      timesPlayed: 0,
      bestScore: 0,
      lastPlayedAt: 0,
    };

    this.data.stats[categoryId] = {
      timesPlayed: current.timesPlayed + 1,
      bestScore: Math.max(current.bestScore, score),
      lastPlayedAt: Date.now(),
    };

    this.saveData();
  }
}

export const db = new Database();
