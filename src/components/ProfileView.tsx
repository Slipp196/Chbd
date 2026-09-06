import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Camera,
  ShieldCheck,
  User as UserIcon,
  Trophy,
  Layers,
  Film,
  Play,
  Pencil,
  AlertTriangle,
  Save,
  Upload,
  LogOut,
  Loader2,
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
  onLogout: () => void;
}

export const PRESET_BANNERS = [
  // 1. Чистый белый баннер (white banner)
  { label: 'Белый минимал', value: 'linear-gradient(135deg, #ffffff 0%, #f4f4f5 50%, #e4e4e7 100%)' },
  // 2. Темный карбон
  { label: 'Карбон', value: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)' },
  // 3. Глубокий черный OLED
  { label: 'Глубокий черный', value: 'linear-gradient(135deg, #050505 0%, #111113 50%, #1a1a1e 100%)' },
  // 4. Королевский аметист (фиолетовый)
  { label: 'Аметист', value: 'linear-gradient(135deg, #2e0854 0%, #581c87 50%, #9333ea 100%)' },
  // 5. Индиго
  { label: 'Индиго', value: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #6366f1 100%)' },
  // 6. Полуночный сапфир (синий)
  { label: 'Сапфир', value: 'linear-gradient(135deg, #09203f 0%, #1e3a8a 50%, #3b82f6 100%)' },
  // 7. Кибернетический циан
  { label: 'Циан', value: 'linear-gradient(135deg, #083344 0%, #0e7490 50%, #06b6d4 100%)' },
  // 8. Изумрудный лес (зеленый)
  { label: 'Изумруд', value: 'linear-gradient(135deg, #022c22 0%, #065f46 50%, #10b981 100%)' },
  // 9. Рубиновый бархат (красный)
  { label: 'Рубин', value: 'linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #ef4444 100%)' },
  // 10. Янтарное золото (оранжевый)
  { label: 'Янтарь', value: 'linear-gradient(135deg, #451a03 0%, #b45309 50%, #f59e0b 100%)' },
  // 11. Неоновая фуксия (розовый)
  { label: 'Фуксия', value: 'linear-gradient(135deg, #500724 0%, #9d174d 50%, #ec4899 100%)' },
  // 12. Платиновый графит
  { label: 'Графит', value: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #64748b 100%)' },
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
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser.bannerUrl || PRESET_BANNERS[0].value);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const url = await api.upload.image(file);
      setAvatarUrl(url);
      const updated = await api.user.updateProfile({ avatarUrl: url });
      onUpdateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки аватара');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleBannerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    setError(null);
    try {
      const url = await api.upload.image(file);
      setBannerUrl(url);
      const updated = await api.user.updateProfile({ bannerUrl: url });
      onUpdateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки баннера');
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

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

  const isBannerColorOrGradient =
    bannerUrl.startsWith('linear-gradient') ||
    bannerUrl.startsWith('#') ||
    bannerUrl.startsWith('rgb');
  const isWhiteBanner =
    bannerUrl.toLowerCase().includes('#ffffff') ||
    bannerUrl.toLowerCase().includes('#f8fafc');

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

      {/* Hidden file inputs for avatar & banner upload */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleAvatarFileSelect}
      />
      <input
        ref={bannerFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleBannerFileSelect}
      />

      {/* Profile Card */}
      <div className="rounded-3xl bg-zinc-900/50 border border-white/[0.08] shadow-2xl overflow-hidden backdrop-blur-xl mb-8">
        {/* Banner */}
        <div
          className="w-full h-44 sm:h-56 relative transition-all"
          style={
            isBannerColorOrGradient
              ? { background: bannerUrl }
              : {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
          }
        >
          <div
            className={`absolute inset-0 pointer-events-none transition-all ${
              isWhiteBanner
                ? 'bg-gradient-to-t from-zinc-950/85 via-zinc-950/20 to-transparent'
                : 'bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent'
            }`}
          />

          {/* Banner Upload Button (Always accessible) */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={() => bannerFileInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/65 hover:bg-black/85 border border-white/20 text-xs font-medium text-white backdrop-blur-md shadow-lg transition-all focus:outline-none"
              title="Загрузить баннер для профиля"
            >
              {isUploadingBanner ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Загрузка...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Сменить баннер</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Header Details */}
        <div className="px-6 sm:px-8 pb-6 relative -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            {/* Avatar & Ident */}
            <div className="flex items-end gap-4">
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-zinc-800 border-4 border-[#111113] shadow-2xl shrink-0 group cursor-pointer"
                title="Нажмите, чтобы загрузить аватар"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                    <UserIcon className="w-10 h-10 opacity-40" />
                  </div>
                )}

                {/* Always-available Hover Overlay for Avatar Upload */}
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white text-[11px] gap-1 opacity-0 group-hover:opacity-100 backdrop-blur-xs transition-opacity">
                  {isUploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Сменить фото</span>
                    </>
                  )}
                </div>

                {/* Small camera badge if not hovered */}
                <div className="absolute bottom-1 right-1 p-1 rounded-lg bg-black/70 text-white border border-white/20 group-hover:opacity-0 transition-opacity">
                  <Camera className="w-3 h-3" />
                </div>
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
                      setBannerUrl(currentUser.bannerUrl || PRESET_BANNERS[0].value);
                      setBio(currentUser.bio || '');
                      setError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    disabled={isSaving || isUploadingAvatar || isUploadingBanner}
                    onClick={handleSaveProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Редактировать профиль</span>
                  </button>
                  <button
                    id="profile-logout-btn"
                    onClick={onLogout}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors"
                    title="Выйти из аккаунта"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </>
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
                  Аватар профиля
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors"
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Загрузка фото...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Загрузить фото с устройства</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-zinc-400">или укажите ссылку:</span>
                </div>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... (прямая ссылка на картинку)"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 mb-2"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Текущий аватар:</span>
                  {avatarUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-xl object-cover border border-white/20"
                      />
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        Сбросить фото
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">По умолчанию (буква имени)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Шапка (баннер) профиля
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors"
                  >
                    {isUploadingBanner ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Загрузка баннера...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Загрузить свой баннер</span>
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-zinc-400">или выберите цвет / вставьте ссылку:</span>
                </div>
                <input
                  type="text"
                  value={isBannerColorOrGradient ? '' : bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://... (прямая ссылка на изображение для фона)"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white/30 mb-2.5"
                />

                {/* Color and Gradient Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-zinc-400 font-medium">Цветовые стили шапки:</span>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                    {PRESET_BANNERS.map((preset, idx) => {
                      const isSelected = bannerUrl === preset.value;
                      const isWhite = preset.label.toLowerCase().includes('белый');
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setBannerUrl(preset.value)}
                          style={{ background: preset.value }}
                          className={`group relative h-9 rounded-xl transition-all duration-200 cursor-pointer ${
                            isWhite ? 'border border-zinc-400/50 shadow-sm' : 'border border-white/10'
                          } ${
                            isSelected
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-105 shadow-md'
                              : 'opacity-80 hover:opacity-100 hover:scale-102'
                          }`}
                          title={preset.label}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className={`w-1.5 h-1.5 rounded-full ${isWhite ? 'bg-zinc-950' : 'bg-white'}`} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
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
