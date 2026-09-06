import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Category, VideoQuestion, CategoryStats, User } from '../src/types';

export function isMainAdminUsername(name?: string | null): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().trim();
  return clean === 'slipp1' || clean === 'slipp1_' || clean === 'admin';
}

export function isMainAdminUser(user?: User | StoredUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (isMainAdminUsername(user.username)) return true;
  if ((user as any).twitchLogin && isMainAdminUsername((user as any).twitchLogin)) return true;
  return false;
}

interface StoredUser {
  id: string;
  username: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  role?: 'admin' | 'user';
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  authProvider?: 'local' | 'twitch';
  twitchLogin?: string;
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
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');

// Default initial categories and questions if database is clean (empty for clean user start)
const INITIAL_CATEGORIES: Category[] = [];
const INITIAL_QUESTIONS: VideoQuestion[] = [];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadData();
    this.ensureAdminUsers();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private ensureAdminUsers() {
    let changed = false;
    for (const u of this.data.users) {
      if (isMainAdminUsername(u.username) || (u.twitchLogin && isMainAdminUsername(u.twitchLogin))) {
        if (u.role !== 'admin') {
          u.role = 'admin';
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveData();
    }
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          return parsed;
        }
      } catch (err) {
        console.error('Failed to parse db.json, checking backup:', err);
      }
    }

    if (fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const rawBackup = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        const parsedBackup = JSON.parse(rawBackup);
        if (parsedBackup && Array.isArray(parsedBackup.users)) {
          console.log('Restored database from backup file.');
          this.saveData(parsedBackup);
          return parsedBackup;
        }
      } catch (err) {
        console.error('Failed to parse db.backup.json:', err);
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
      const content = JSON.stringify(data, null, 2);
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, content, 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);

      if (data.users.length > 0 || data.categories.length > 0) {
        fs.writeFileSync(DB_BACKUP_FILE, content, 'utf-8');
      }
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
      // Check if password matches existing account to log in smoothly
      const hash = this.hashPassword(password, existing.salt);
      if (hash === existing.passwordHash) {
        if (isMainAdminUsername(existing.username)) {
          existing.role = 'admin';
        }
        const token = crypto.randomBytes(32).toString('hex');
        this.data.sessions.push({ token, userId: existing.id, createdAt: Date.now() });
        this.saveData();
        return { user: this.toUser(existing), token };
      }

      // If slipp1 or slipp1_, allow updating password for account recovery
      if (isMainAdminUsername(trimmed)) {
        const newSalt = crypto.randomBytes(16).toString('hex');
        existing.salt = newSalt;
        existing.passwordHash = this.hashPassword(password, newSalt);
        existing.role = 'admin';
        const token = crypto.randomBytes(32).toString('hex');
        this.data.sessions.push({ token, userId: existing.id, createdAt: Date.now() });
        this.saveData();
        return { user: this.toUser(existing), token };
      }

      throw new Error('Пользователь с таким никнеймом уже существует. Попробуйте войти');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const isAdmin = isMainAdminUsername(trimmed);
    const storedUser: StoredUser = {
      id,
      username: trimmed,
      salt,
      passwordHash,
      createdAt: Date.now(),
      role: isAdmin ? 'admin' : 'user',
      authProvider: 'local',
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
      user: this.toUser(storedUser),
      token,
    };
  }

  public loginOrRegisterWithTwitch(twitchData: {
    login: string;
    displayName?: string;
    id?: string;
    profileImageURL?: string;
    description?: string;
  }): { user: User; token: string } {
    const cleanLogin = twitchData.login.trim();
    const displayName = (twitchData.displayName || cleanLogin).trim();

    const isAdmin = isMainAdminUsername(cleanLogin) || isMainAdminUsername(displayName);

    let user = this.data.users.find(
      (u) =>
        (u.twitchLogin && u.twitchLogin.toLowerCase() === cleanLogin.toLowerCase()) ||
        u.username.toLowerCase() === cleanLogin.toLowerCase() ||
        u.username.toLowerCase() === displayName.toLowerCase()
    );

    if (user) {
      user.twitchLogin = cleanLogin;
      user.authProvider = 'twitch';
      if (!user.avatarUrl && twitchData.profileImageURL) {
        user.avatarUrl = twitchData.profileImageURL;
      }
      if (!user.bio && twitchData.description) {
        user.bio = twitchData.description;
      }
      if (isAdmin) {
        user.role = 'admin';
      }
    } else {
      const id = `u_tw_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      user = {
        id,
        username: displayName,
        salt: 'twitch',
        passwordHash: 'twitch_oauth',
        createdAt: Date.now(),
        role: isAdmin ? 'admin' : 'user',
        avatarUrl: twitchData.profileImageURL,
        bio: twitchData.description,
        authProvider: 'twitch',
        twitchLogin: cleanLogin,
      };
      this.data.users.push(user);
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions.push({
      token,
      userId: user.id,
      createdAt: Date.now(),
    });

    this.saveData();

    return {
      user: this.toUser(user),
      token,
    };
  }

  private toUser(stored: StoredUser): User {
    const isAdmin = isMainAdminUser(stored);
    return {
      id: stored.id,
      username: stored.username,
      createdAt: stored.createdAt,
      role: isAdmin ? 'admin' : (stored.role || 'user'),
      avatarUrl: stored.avatarUrl,
      bannerUrl: stored.bannerUrl,
      bio: stored.bio,
      authProvider: stored.authProvider || 'local',
      twitchLogin: stored.twitchLogin,
    };
  }

  public loginUser(username: string, password: string): { user: User; token: string } {
    const trimmed = username.trim();
    const user = this.data.users.find(
      (u) =>
        u.username.toLowerCase() === trimmed.toLowerCase() ||
        (u.twitchLogin && u.twitchLogin.toLowerCase() === trimmed.toLowerCase())
    );
    if (!user) {
      // If slipp1 or slipp1_, auto-register with provided password
      if (isMainAdminUsername(trimmed)) {
        return this.registerUser(trimmed, password);
      }
      throw new Error('Неверный никнейм или пароль');
    }

    if (user.authProvider === 'twitch' && user.passwordHash === 'twitch_oauth') {
      const token = crypto.randomBytes(32).toString('hex');
      this.data.sessions.push({ token, userId: user.id, createdAt: Date.now() });
      if (isMainAdminUser(user)) user.role = 'admin';
      this.saveData();
      return { user: this.toUser(user), token };
    }

    const hash = this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      if (isMainAdminUsername(trimmed)) {
        const newSalt = crypto.randomBytes(16).toString('hex');
        user.salt = newSalt;
        user.passwordHash = this.hashPassword(password, newSalt);
        user.role = 'admin';
      } else {
        throw new Error('Неверный никнейм или пароль');
      }
    }

    if (isMainAdminUsername(user.username)) {
      user.role = 'admin';
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions.push({
      token,
      userId: user.id,
      createdAt: Date.now(),
    });

    this.saveData();

    return {
      user: this.toUser(user),
      token,
    };
  }

  public getUserByToken(token: string): User | null {
    if (!token) return null;
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return null;

    const user = this.data.users.find((u) => u.id === session.userId);
    if (!user) return null;

    if (isMainAdminUsername(user.username) && user.role !== 'admin') {
      user.role = 'admin';
      this.saveData();
    }

    return this.toUser(user);
  }

  public updateProfile(
    userId: string,
    updates: { avatarUrl?: string; bannerUrl?: string; bio?: string }
  ): User {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (typeof updates.avatarUrl === 'string') user.avatarUrl = updates.avatarUrl;
    if (typeof updates.bannerUrl === 'string') user.bannerUrl = updates.bannerUrl;
    if (typeof updates.bio === 'string') user.bio = updates.bio;

    this.saveData();
    return this.toUser(user);
  }

  public logoutUser(token: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.saveData();
  }

  // --- Categories ---
  public getCategories(user?: User | null, adminViewMode: 'admin' | 'user_preview' = 'admin'): Category[] {
    const isMainAdmin = isMainAdminUser(user);
    const effectiveIsAdmin = isMainAdmin && adminViewMode === 'admin';

    return this.data.categories.filter((cat) => {
      // If admin in admin mode: sees everything!
      if (effectiveIsAdmin) {
        return true;
      }

      // If category was removed by admin:
      if (cat.status === 'removed_by_admin') {
        // Only visible to the author so the author knows it was removed
        return user && cat.authorId === user.id;
      }

      // In "Играть" all users can see and play all published themes from any user!
      return true;
    });
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
    const isMainAdmin = isMainAdminUser(user);

    // Only allow if admin or author
    if (!isMainAdmin && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор или администратор может редактировать эту тему');
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

  public deleteCategory(id: string, user?: User | null): { deleted: boolean; status?: string } {
    const index = this.data.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return { deleted: false };
    }

    const category = this.data.categories[index];
    const isMainAdmin = isMainAdminUser(user);
    const isAuthor = category.authorId && user && category.authorId === user.id;

    if (!isMainAdmin && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор или администратор может удалить эту тему');
    }

    // If main admin deleted someone else's theme:
    // Mark status: 'removed_by_admin' and set adminNotice, so the author gets notified
    if (isMainAdmin && !isAuthor && category.authorId) {
      this.data.categories[index] = {
        ...category,
        status: 'removed_by_admin',
        adminNotice: 'Тема снята с публикации главным администратором (slipp1)',
      };
      this.saveData();
      return { deleted: false, status: 'removed_by_admin' };
    } else {
      // Author deleted their own theme or dismissed the notice: permanently delete!
      this.data.categories.splice(index, 1);
      this.data.questions = this.data.questions.filter((q) => q.categoryId !== id);
      this.saveData();
      return { deleted: true };
    }
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

    const isMainAdmin = isMainAdminUser(user);
    if (!isMainAdmin && category && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор темы или администратор может редактировать клипы');
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
    const isMainAdmin = isMainAdminUser(user);

    if (!isMainAdmin && category && category.authorId && user && category.authorId !== user.id) {
      throw new Error('Только автор темы или администратор может удалять клипы');
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
