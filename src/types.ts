export interface User {
  id: string;
  username: string;
  createdAt: number;
  role?: 'admin' | 'user';
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  authProvider?: 'local' | 'twitch';
  twitchLogin?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface AnswerOption {
  id: string;
  text: string;
}

export interface VideoQuestion {
  id: string;
  categoryId: string;
  title: string;
  prompt: string; // e.g. "Что было дальше?"
  videoUrl: string;
  videoBlobKey?: string; // Key in IndexedDB if user uploaded custom video
  pauseTime: number; // in seconds where video must stop
  options: AnswerOption[];
  correctOptionId: string;
  explanation?: string; // Optional context of what actually happened
  authorId?: string | null;
  createdAt: number;
}

export interface Category {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  icon?: string;
  tag?: string;
  color?: string;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: number;
  status?: 'active' | 'removed_by_admin';
  adminNotice?: string;
}

export interface GameAnswerRecord {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timeTakenSeconds?: number;
}

export interface GameSession {
  categoryId: string;
  currentQuestionIndex: number;
  score: number;
  streak: number;
  answers: Record<string, GameAnswerRecord>;
  isCompleted: boolean;
}

export interface CategoryStats {
  timesPlayed: number;
  bestScore: number;
  lastPlayedAt: number;
}
