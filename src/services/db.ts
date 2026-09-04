import { Category, VideoQuestion, CategoryStats } from '../types';

const DEMO_CATEGORY_IDS = new Set(['cat_extreme', 'cat_twitch', 'cat_tiktok']);
const DEMO_QUESTION_IDS = new Set(['q_bike_1', 'q_bike_2', 'q_bike_3', 'q_twitch_1', 'q_tiktok_1']);

const STORAGE_KEYS = {
  CATEGORIES: 'chbd_categories_v3',
  QUESTIONS: 'chbd_questions_v3',
  STATS: 'chbd_stats_v3',
};

// Clean up legacy storage from old demo version if present
if (typeof window !== 'undefined') {
  try {
    ['chbd_categories_v2', 'chbd_categories_v1', 'chbd_questions_v2', 'chbd_questions_v1'].forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {}
}

const DB_NAME = 'chbd_video_store';
const STORE_NAME = 'videos';

// --- IndexedDB for custom uploaded video files ---
function openVideoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeVideoBlob(key: string, blob: Blob): Promise<void> {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getVideoBlob(key: string): Promise<Blob | null> {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVideoBlob(key: string): Promise<void> {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Pre-packaged catalog of demo clips for easy testing in Admin Panel
export interface SampleClip {
  id: string;
  name: string;
  url: string;
  durationApprox: string;
  description: string;
}

export const SAMPLE_VIDEO_PRESETS: SampleClip[] = [
  {
    id: 'sample_escape',
    name: 'Велосипедист и препятствия',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    durationApprox: '15 сек',
    description: 'Парень мчит на скорости через узкие улочки и лестницы',
  },
  {
    id: 'sample_blazes',
    name: 'Экстрим на рампе и трюки',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationApprox: '15 сек',
    description: 'Взлет на трамплине и опасное приземление',
  },
  {
    id: 'sample_joy',
    name: 'Спуск по склону и поворот',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    durationApprox: '15 сек',
    description: 'Скоростной вираж перед крутым обрывом',
  },
  {
    id: 'sample_meltdowns',
    name: 'Попытка супер-финта',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    durationApprox: '15 сек',
    description: 'Сложный акробатический маневр на пределе возможностей',
  },
  {
    id: 'sample_bunny',
    name: 'Кролик и неожиданный бросок',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    durationApprox: '30 сек',
    description: 'Забавный персонаж готовит коварную ловушку',
  },
];

// Initial categories and questions (empty for clean start)
const INITIAL_CATEGORIES: Category[] = [];
const INITIAL_QUESTIONS: VideoQuestion[] = [];

export function getStoredCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      return INITIAL_CATEGORIES;
    }
    const parsed: Category[] = JSON.parse(raw);
    const clean = parsed.filter((c) => !DEMO_CATEGORY_IDS.has(c.id));
    return clean;
  } catch (e) {
    console.error('Failed to load categories', e);
    return INITIAL_CATEGORIES;
  }
}

export function saveCategories(categories: Category[]): void {
  try {
    const clean = categories.filter((c) => !DEMO_CATEGORY_IDS.has(c.id));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
}

export function getStoredQuestions(): VideoQuestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
      return INITIAL_QUESTIONS;
    }
    const parsed: VideoQuestion[] = JSON.parse(raw);
    const clean = parsed.filter((q) => !DEMO_QUESTION_IDS.has(q.id) && !DEMO_CATEGORY_IDS.has(q.categoryId));
    return clean;
  } catch (e) {
    console.error('Failed to load questions', e);
    return INITIAL_QUESTIONS;
  }
}

export function saveQuestions(questions: VideoQuestion[]): void {
  try {
    const clean = questions.filter((q) => !DEMO_QUESTION_IDS.has(q.id) && !DEMO_CATEGORY_IDS.has(q.categoryId));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to save questions', e);
  }
}

export function getCategoryStats(): Record<string, CategoryStats> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function updateCategoryStats(categoryId: string, score: number): void {
  try {
    const stats = getCategoryStats();
    const existing = stats[categoryId] || { timesPlayed: 0, bestScore: 0, lastPlayedAt: 0 };
    stats[categoryId] = {
      timesPlayed: existing.timesPlayed + 1,
      bestScore: Math.max(existing.bestScore, score),
      lastPlayedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to update stats', e);
  }
}

export function resetAllDataToDefault(): void {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
  localStorage.removeItem(STORAGE_KEYS.STATS);
}
