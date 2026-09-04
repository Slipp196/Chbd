import React, { useState, useEffect } from 'react';
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
import { AuthModal } from './components/AuthModal';
import { DownloadModal } from './components/DownloadModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'play' | 'admin'>('play');
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [stats, setStats] = useState<Record<string, CategoryStats>>({});

  // Auth & Download modal states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  // Load initial data from Backend API, with seamless local storage fallback
  const loadData = async () => {
    // 1. Auth check
    try {
      const user = await api.auth.getMe();
      setCurrentUser(user);
    } catch {
      // offline or guest
    }

    // 2. Categories
    try {
      const remoteCategories = await api.categories.getAll();
      if (Array.isArray(remoteCategories)) {
        const clean = remoteCategories.filter(
          (c) => c.id !== 'cat_extreme' && c.id !== 'cat_twitch' && c.id !== 'cat_tiktok'
        );
        setCategories(clean);
        saveCategories(clean);
      } else {
        setCategories(getStoredCategories());
      }
    } catch {
      setCategories(getStoredCategories());
    }

    // 3. Questions
    try {
      const remoteQuestions = await api.questions.getAll();
      if (Array.isArray(remoteQuestions)) {
        const cleanQuestions = remoteQuestions.filter(
          (q) =>
            !['q_bike_1', 'q_bike_2', 'q_bike_3', 'q_twitch_1', 'q_tiktok_1'].includes(q.id) &&
            !['cat_extreme', 'cat_twitch', 'cat_tiktok'].includes(q.categoryId)
        );
        setQuestions(cleanQuestions);
        saveQuestions(cleanQuestions);
      } else {
        setQuestions(getStoredQuestions());
      }
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
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for persistence
  const handleSaveCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  const handleSaveQuestions = (newQuestions: VideoQuestion[]) => {
    setQuestions(newQuestions);
    saveQuestions(newQuestions);
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

  return (
    <div className="min-h-screen bg-[#111113] text-zinc-100 flex flex-col selection:bg-zinc-700 selection:text-white">
      {/* Floating Zen / ChatGPT Header */}
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
    </div>
  );
}
