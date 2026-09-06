import React, { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { Category, VideoQuestion, CategoryStats, User } from './types';
import {
  getStoredCategories,
  saveCategories,
  getStoredQuestions,
  saveQuestions,
  getCategoryStats,
  updateCategoryStats,
  resetAllDataToDefault,
} from './services/db';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { CategoryList } from './components/CategoryList';
import { GamePlayer } from './components/GamePlayer';
import { GameCompleteModal } from './components/GameCompleteModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { DownloadModal } from './components/DownloadModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'play' | 'admin' | 'profile'>('play');
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [stats, setStats] = useState<Record<string, CategoryStats>>({});

  // Auth & Admin states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'user_preview'>('admin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  // Active game state
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [isGameFinished, setIsGameFinished] = useState<boolean>(false);
  const [gameResult, setGameResult] = useState<{
    score: number;
    correctCount: number;
    totalCount: number;
  } | null>(null);

  // Admin routing helper
  const [adminSelectedCategoryId, setAdminSelectedCategoryId] = useState<string | null>(null);

  // Load data from Backend API (Server is authoritative; does NOT resurrect deleted items)
  const loadData = useCallback(async (overrideViewMode?: 'admin' | 'user_preview') => {
    const viewModeToUse = overrideViewMode || adminViewMode;

    // 1. Auth check
    try {
      const user = await api.auth.getMe();
      setCurrentUser(user);
    } catch {
      // offline or guest
    }

    // 2. Categories
    try {
      const remoteCategories = await api.categories.getAll(viewModeToUse);
      const cleanRemote = Array.isArray(remoteCategories)
        ? remoteCategories.filter((c) => c.id !== 'cat_extreme' && c.id !== 'cat_twitch' && c.id !== 'cat_tiktok')
        : [];

      // Merge with any local storage categories (e.g. created offline, from friend, or pre-existing)
      const storedLocal = getStoredCategories();
      const mergedCats = [...cleanRemote];
      storedLocal.forEach((locCat) => {
        if (!mergedCats.some((c) => c.id === locCat.id)) {
          mergedCats.push(locCat);
          // Sync missing local categories to server so they persist for all
          api.categories.create(locCat).catch(() => {});
        }
      });

      setCategories(mergedCats);
      saveCategories(mergedCats);
    } catch {
      setCategories(getStoredCategories());
    }

    // 3. Questions
    try {
      const remoteQuestions = await api.questions.getAll();
      const cleanRemote = Array.isArray(remoteQuestions)
        ? remoteQuestions.filter(
            (q) =>
              !['q_bike_1', 'q_bike_2', 'q_bike_3', 'q_twitch_1', 'q_tiktok_1'].includes(q.id) &&
              !['cat_extreme', 'cat_twitch', 'cat_tiktok'].includes(q.categoryId)
          )
        : [];

      const storedLocal = getStoredQuestions();
      const mergedQuestions = [...cleanRemote];
      storedLocal.forEach((locQ) => {
        if (!mergedQuestions.some((q) => q.id === locQ.id)) {
          mergedQuestions.push(locQ);
          api.questions.create(locQ).catch(() => {});
        }
      });

      setQuestions(mergedQuestions);
      saveQuestions(mergedQuestions);
    } catch {
      setQuestions(getStoredQuestions());
    }

    // 4. Stats
    try {
      const remoteStats = await api.stats.get();
      if (remoteStats && Object.keys(remoteStats).length > 0) {
        setStats(remoteStats);
      } else {
        setStats(getCategoryStats());
      }
    } catch {
      setStats(getCategoryStats());
    }
  }, [adminViewMode]);

  useEffect(() => {
    loadData();

    // Auto-refresh when switching back to window or periodically
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => loadData(), 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadData]);

  // Toggle admin view mode
  const handleToggleAdminViewMode = () => {
    const nextMode = adminViewMode === 'admin' ? 'user_preview' : 'admin';
    setAdminViewMode(nextMode);
    loadData(nextMode);
  };

  // Handlers for persistence: save locally AND sync to server immediately
  const handleSaveCategories = async (newCategories: Category[]) => {
    setCategories(newCategories);
    saveCategories(newCategories);
    try {
      await api.categories.sync(newCategories);
    } catch (e) {
      console.error('Failed to sync categories to server', e);
    }
  };

  const handleSaveQuestions = async (newQuestions: VideoQuestion[]) => {
    setQuestions(newQuestions);
    saveQuestions(newQuestions);
    try {
      await api.questions.sync(newQuestions);
    } catch (e) {
      console.error('Failed to sync questions to server', e);
    }
  };

  const handleResetAllData = () => {
    resetAllDataToDefault();
    setCategories(getStoredCategories());
    setQuestions(getStoredQuestions());
    setStats({});
    setActiveCategory(null);
    setIsGameFinished(false);
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setCurrentUser(null);
    setCurrentTab('play');
    loadData();
  };

  // Game lifecycle
  const handleSelectCategory = (category: Category) => {
    setActiveCategory(category);
    setCurrentScore(0);
    setIsGameFinished(false);
    setGameResult(null);
  };

  const handleFinishGame = (
    finalScore: number,
    answersCount: { correct: number; total: number }
  ) => {
    if (activeCategory) {
      updateCategoryStats(activeCategory.id, finalScore);
      setStats(getCategoryStats());
      api.stats.update(activeCategory.id, finalScore).catch(() => {});
    }
    setGameResult({
      score: finalScore,
      correctCount: answersCount.correct,
      totalCount: answersCount.total,
    });
    setIsGameFinished(true);
  };

  const handlePlayAgain = () => {
    setIsGameFinished(false);
    setCurrentScore(0);
    setGameResult(null);
  };

  const handleExitToCategories = () => {
    setActiveCategory(null);
    setIsGameFinished(false);
    setGameResult(null);
    setCurrentScore(0);
  };

  const handleOpenAdminFromGame = () => {
    setCurrentTab('admin');
    if (activeCategory) {
      setAdminSelectedCategoryId(activeCategory.id);
    }
  };

  // Questions for current game
  const activeQuestions = activeCategory
    ? questions.filter((q) => q.categoryId === activeCategory.id)
    : [];

  const isUserAdmin =
    currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'slipp1';

  return (
    <div className="min-h-screen bg-[#111113] text-zinc-100 flex flex-col selection:bg-zinc-700 selection:text-white">
      {/* Floating Zen Header */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === 'play' && isGameFinished) {
            handleExitToCategories();
          }
        }}
        onExitCategory={handleExitToCategories}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenDownload={() => setIsDownloadModalOpen(true)}
        adminViewMode={adminViewMode}
        onToggleAdminViewMode={handleToggleAdminViewMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col">
        {currentTab === 'play' ? (
          <>
            {!activeCategory && (
              <CategoryList
                categories={categories}
                questions={questions}
                stats={stats}
                onSelectCategory={handleSelectCategory}
                onOpenAdminTab={() => setCurrentTab('admin')}
                onOpenAdminCategory={(catId) => {
                  setAdminSelectedCategoryId(catId);
                  setCurrentTab('admin');
                }}
              />
            )}

            {activeCategory && !isGameFinished && (
              <GamePlayer
                key={activeCategory.id}
                category={activeCategory}
                questions={activeQuestions}
                onExit={handleExitToCategories}
                onFinishGame={handleFinishGame}
                onScoreUpdate={setCurrentScore}
              />
            )}

            {activeCategory && isGameFinished && gameResult && (
              <GameCompleteModal
                category={activeCategory}
                score={gameResult.score}
                correctCount={gameResult.correctCount}
                totalCount={gameResult.totalCount}
                onPlayAgain={handlePlayAgain}
                onExitToCategories={handleExitToCategories}
                onOpenAdmin={handleOpenAdminFromGame}
              />
            )}
          </>
        ) : currentTab === 'profile' && currentUser ? (
          <ProfileView
            currentUser={currentUser}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            categories={categories}
            questions={questions}
            stats={stats}
            onSelectCategory={(cat) => {
              handleSelectCategory(cat);
              setCurrentTab('play');
            }}
            onEditCategory={(catId) => {
              setAdminSelectedCategoryId(catId);
              setCurrentTab('admin');
            }}
            onBack={() => setCurrentTab('play')}
            onLogout={handleLogout}
          />
        ) : (
          <AdminPanel
            categories={categories}
            questions={questions}
            initialSelectedCategoryId={adminSelectedCategoryId}
            currentUser={currentUser}
            onRequireAuth={() => setIsAuthModalOpen(true)}
            onSaveCategories={handleSaveCategories}
            onSaveQuestions={handleSaveQuestions}
            onResetAllData={handleResetAllData}
            adminViewMode={adminViewMode}
            onPlayCategory={(cat) => {
              setActiveCategory(cat);
              setCurrentTab('play');
              setIsGameFinished(false);
              setGameResult(null);
            }}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />

      {/* Download Modal */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* Floating Bottom-Right Admin / Guest View Switcher */}
      {isUserAdmin && (
        <aside
          aria-label="Режим отображения"
          className="fixed bottom-5 right-5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <button
            id="bottom-admin-view-toggle"
            type="button"
            onClick={handleToggleAdminViewMode}
            title={
              adminViewMode === 'user_preview'
                ? 'Режим гостя (обычного игрока). Нажмите, чтобы вернуться в режим администратора'
                : 'Режим администратора. Нажмите, чтобы посмотреть сайт глазами игрока'
            }
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none ${
              adminViewMode === 'user_preview'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-200'
                : 'bg-zinc-900/90 hover:bg-zinc-800/95 border-white/15 text-zinc-200 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4 text-current transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold tracking-wide">
              {adminViewMode === 'user_preview' ? 'Вид: Гость' : 'Вид: Админ'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                adminViewMode === 'user_preview' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
          </button>
        </aside>
      )}
    </div>
  );
}
