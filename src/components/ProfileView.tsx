import React, { useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  Trophy,
  Layers,
  Film,
  Play,
  Pencil,
  AlertTriangle,
  Save,
  X,
  Check,
} from 'lucide-react';
import { User, Category, VideoQuestion, CategoryStats } from '../types';
import { api } from '../services/api';

interface ProfileViewProps {
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  categories: Category[];
  questions: VideoQuestion[];
  stats: Record<string, CategoryStats>;
  onSelectCategory: (category: Category) => void;
  onEditCategory: (categoryId: string) => void;
  onBack: () => void;
}

const PRESET_BANNERS = [
  'linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)',
  'linear-gradient(135deg, #09203f 0%, #537895 100%)',
  'linear-gradient(135deg, #2b1055 0%, #7597de 100%)',
  'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
  'linear-gradient(135deg, #16222a 0%, #3a6073 100%)',
];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&auto=format&fit=crop&q=80',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateUser,
  categories,
  questions,
  stats,
  onSelectCategory,
  onEditCategory,
  onBack,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser.bannerUrl || PRESET_BANNERS[0]);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User's authored themes
  const userCategories = categories.filter(
    (c) => c.authorId === currentUser.id || (!c.authorId && currentUser.role === 'admin')
  );

  // Calculate stats
  let totalScore = 0;
  let playedCount = 0;
  Object.values(stats).forEach((s) => {
    const item = s as CategoryStats;
    totalScore += item.bestScore || 0;
    if (item.timesPlayed > 0) playedCount += 1;
  });

  const totalQuestionsCreated = questions.filter((q) => {
    const cat = categories.find((c) => c.id === q.categoryId);
    return cat?.authorId === currentUser.id;
  }).length;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await api.user.updateProfile({
        avatarUrl: avatarUrl.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        bio: bio.trim(),
      });
      onUpdateUser(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения профиля');
    } finally {
      setIsSaving(false);
    }
  };

  const isBannerGradient = bannerUrl.startsWith('linear-gradient');

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-16">
      {/* Top navigation */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/70 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>К темам</span>
        </button>
      </div>

      {/* Profile Card */}
      <div className="rounded-3xl bg-zinc-900/50 border border-white/[0.08] shadow-2xl overflow-hidden backdrop-blur-xl mb-8">
        {/* Banner */}
        <div
          className="w-full h-44 sm:h-56 relative transition-all"
          style={
            isBannerGradient
              ? { background: bannerUrl }
              : {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

          {isEditing && (
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <span className="text-xs bg-black/60 px-3 py-1.5 rounded-full text-zinc-200 backdrop-blur-md">
                Выберите фон или укажите ссылку
              </span>
            </div>
          )}
        </div>

        {/* Header Details */}
        <div className="px-6 sm:px-8 pb-6 relative -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            {/* Avatar & Ident */}
            <div className="flex items-end gap-4">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-zinc-800 border-4 border-[#111113] shadow-2xl shrink-0 group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                    <UserIcon className="w-10 h-10 opacity-40" />
                  </div>
                )}

                {isEditing && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs opacity-90 backdrop-blur-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
                    {currentUser.username}
                  </h1>
                  {currentUser.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Администратор
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Участник с {new Date(currentUser.createdAt || Date.now()).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setAvatarUrl(currentUser.avatarUrl || '');
                      setBannerUrl(currentUser.bannerUrl || PRESET_BANNERS[0]);
                      setBio(currentUser.bio || '');
                      setError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={handleSaveProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Редактировать профиль</span>
                </button>
              )}
            </div>
          </div>

          {/* Edit form controls */}
          {isEditing && (
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/10 mb-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  О себе (Bio)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Расскажите о себе, любимых темах или стримерах..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Аватар (ссылка или выберите готовый)
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... (прямая ссылка на картинку)"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 mb-2"
                />
                <div className="flex items-center gap-2">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-8 h-8 rounded-xl overflow-hidden border-2 transition-all ${
                        avatarUrl === preset ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={preset} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-2 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Шапка профиля (градиент или ссылка)
                </label>
                <input
                  type="text"
                  value={bannerUrl.startsWith('linear-gradient') ? '' : bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://... (прямая ссылка на изображение для фона)"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 mb-2"
                />
                <div className="flex items-center gap-2">
                  {PRESET_BANNERS.map((grad, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBannerUrl(grad)}
                      style={{ background: grad }}
                      className={`w-8 h-6 rounded-lg border-2 transition-all ${
                        bannerUrl === grad ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      title={`Градиент #${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bio text */}
          {!isEditing && (
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed mb-6">
              {currentUser.bio || 'Пока нет описания профиля. Нажмите «Редактировать профиль», чтобы добавить.'}
            </p>
          )}

          {/* User Metrics Bento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Очков набрано</span>
              </div>
              <div className="text-xl font-bold text-zinc-100">{totalScore}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Игр сыграно</span>
              </div>
              <div className="text-xl font-bold text-zinc-100">{playedCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Создано тем</span>
              </div>
              <div className="text-xl font-bold text-zinc-100">{userCategories.length}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Film className="w-3.5 h-3.5 text-violet-400" />
                <span>Создано клипов</span>
              </div>
              <div className="text-xl font-bold text-zinc-100">{totalQuestionsCreated}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wall of Themes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
              Стена тем пользователя
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-300 font-medium">
              {userCategories.length}
            </span>
          </div>
        </div>

        {userCategories.length === 0 ? (
          <div className="p-10 rounded-3xl bg-zinc-900/30 border border-white/[0.06] text-center">
            <Layers className="w-8 h-8 opacity-30 mx-auto mb-2 text-zinc-400" />
            <p className="text-xs text-zinc-400">
              Вы еще не создали ни одной темы. Перейдите в редактор, чтобы создать первую тему!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {userCategories.map((category) => {
              const catQuestions = questions.filter((q) => q.categoryId === category.id);
              const isRemovedByAdmin = category.status === 'removed_by_admin';

              return (
                <div
                  key={category.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all backdrop-blur-md ${
                    isRemovedByAdmin
                      ? 'bg-rose-950/10 border-rose-500/30'
                      : 'bg-zinc-900/50 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div>
                    {isRemovedByAdmin && (
                      <div className="mb-2.5 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Скрыто администратором:</span>{' '}
                          {category.adminNotice || 'Тема нарушает правила сообщества'}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">
                        {category.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 text-[10px] text-zinc-300 shrink-0">
                        {catQuestions.length} клипов
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                      {category.description || 'Без описания'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => onSelectCategory(category)}
                      disabled={catQuestions.length === 0}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Играть</span>
                    </button>

                    <button
                      onClick={() => onEditCategory(category.id)}
                      className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-white/10"
                      title="Редактировать тему"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
