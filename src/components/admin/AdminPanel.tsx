import React, { useState } from 'react';
import {
  FolderPlus,
  Plus,
  Edit2,
  Trash2,
  Film,
  Play,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  Lock,
  User as UserIcon,
} from 'lucide-react';
import { Category, VideoQuestion, User } from '../../types';
import { CategoryModal } from './CategoryModal';
import { VideoEditorModal } from './VideoEditorModal';
import { deleteVideoBlob } from '../../services/db';
import { api } from '../../services/api';

interface AdminPanelProps {
  categories: Category[];
  questions: VideoQuestion[];
  initialSelectedCategoryId?: string | null;
  currentUser: User | null;
  onRequireAuth: () => void;
  onSaveCategories: (categories: Category[]) => void;
  onSaveQuestions: (questions: VideoQuestion[]) => void;
  onResetAllData?: () => void;
  onPlayCategory: (category: Category) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  categories,
  questions,
  initialSelectedCategoryId,
  currentUser,
  onRequireAuth,
  onSaveCategories,
  onSaveQuestions,
  onPlayCategory,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialSelectedCategoryId || categories[0]?.id || ''
  );

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<VideoQuestion | null>(null);

  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Category
  const activeCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;

  // Filter questions for active category
  const activeQuestions = questions.filter(
    (q) => q.categoryId === (activeCategory ? activeCategory.id : '')
  );

  // Can current user edit the active category?
  const canEditActiveCategory = Boolean(
    activeCategory &&
      (!activeCategory.authorId || (currentUser && currentUser.id === activeCategory.authorId))
  );

  const canEditCategory = (cat: Category) => {
    return !cat.authorId || (currentUser && currentUser.id === cat.authorId);
  };

  // Categories CRUD
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (data: Omit<Category, 'createdAt'> & { id?: string }) => {
    if (data.id) {
      const existing = categories.find((c) => c.id === data.id);
      if (existing && existing.authorId && currentUser && currentUser.id !== existing.authorId) {
        setErrorMessage('Только автор может редактировать эту тему');
        return;
      }

      const updated = categories.map((c) =>
        c.id === data.id
          ? {
              ...c,
              title: data.title,
              description: data.description,
              tag: data.tag,
              imageUrl: data.imageUrl,
            }
          : c
      );
      onSaveCategories(updated);
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: data.title,
        description: data.description,
        tag: data.tag,
        imageUrl: data.imageUrl,
        authorId: currentUser?.id || null,
        authorName: currentUser?.username || 'Автор',
        createdAt: Date.now(),
      };
      const updated = [...categories, newCat];
      onSaveCategories(updated);
      setSelectedCategoryId(newCat.id);
    }
  };

  const handleDeleteCategory = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (cat && cat.authorId && currentUser && currentUser.id !== cat.authorId) {
      setErrorMessage('Только автор может удалить эту тему');
      setConfirmDeleteCatId(null);
      return;
    }

    const questionsToDelete = questions.filter((q) => q.categoryId === catId);
    questionsToDelete.forEach((q) => {
      if (q.videoBlobKey) {
        deleteVideoBlob(q.videoBlobKey).catch(console.error);
      }
    });

    const updatedCategories = categories.filter((c) => c.id !== catId);
    const updatedQuestions = questions.filter((q) => q.categoryId !== catId);

    onSaveCategories(updatedCategories);
    onSaveQuestions(updatedQuestions);
    api.categories.delete(catId).catch(console.error);

    if (selectedCategoryId === catId) {
      setSelectedCategoryId(updatedCategories[0]?.id || '');
    }
    setConfirmDeleteCatId(null);
  };

  // Questions CRUD
  const handleSaveQuestion = (questionData: VideoQuestion) => {
    if (!canEditActiveCategory) {
      setErrorMessage('Только автор темы может сохранять клипы');
      return;
    }

    const questionWithAuthor: VideoQuestion = {
      ...questionData,
      authorId: questionData.authorId || currentUser?.id || null,
    };

    const existingIndex = questions.findIndex((q) => q.id === questionData.id);
    if (existingIndex >= 0) {
      const updated = [...questions];
      updated[existingIndex] = questionWithAuthor;
      onSaveQuestions(updated);
    } else {
      onSaveQuestions([...questions, questionWithAuthor]);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!canEditActiveCategory) {
      setErrorMessage('Только автор темы может удалять клипы');
      return;
    }

    const q = questions.find((item) => item.id === questionId);
    if (q?.videoBlobKey) {
      await deleteVideoBlob(q.videoBlobKey).catch(console.error);
    }
    const updated = questions.filter((item) => item.id !== questionId);
    onSaveQuestions(updated);
    api.questions.delete(questionId).catch(console.error);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!canEditActiveCategory) return;

    const list = [...activeQuestions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const otherQuestions = questions.filter(
      (q) => q.categoryId !== (activeCategory ? activeCategory.id : '')
    );
    onSaveQuestions([...otherQuestions, ...list]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      {/* Top Notification / Error */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white px-2 py-0.5 rounded-lg text-[11px]"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Clean Top Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Создать ЧБД
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {currentUser ? (
              <span>Вы вошли как <strong className="text-zinc-200">@{currentUser.username}</strong></span>
            ) : (
              <span>Войдите, чтобы ваши созданные темы принадлежали вам</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewCategory}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-sm transition-all focus:outline-none"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Новая тема</span>
          </button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Column: Categories List */}
        <div className="md:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Темы ({categories.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {categories.map((cat) => {
              const isSelected = activeCategory?.id === cat.id;
              const count = questions.filter((q) => q.categoryId === cat.id).length;
              const userOwnsCat = canEditCategory(cat);

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800/90 border-white/20 text-white shadow-md'
                      : 'bg-zinc-900/40 hover:bg-zinc-900/80 border-white/[0.06] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-xl object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${
                          isSelected
                            ? 'bg-white text-zinc-950'
                            : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-semibold truncate leading-snug">{cat.title}</h4>
                        {!userOwnsCat && (
                          <Lock className="w-3 h-3 text-zinc-400 shrink-0" title="Только автор может редактировать" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {count} {count === 1 ? 'клип' : count >= 2 && count <= 4 ? 'клипа' : 'клипов'}
                        {cat.authorName && ` • @${cat.authorName}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions for category */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    {userOwnsCat ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                            setIsCategoryModalOpen(true);
                          }}
                          className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          title="Редактировать тему"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteCatId(cat.id);
                          }}
                          className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <span className="p-1 text-zinc-500 text-[10px]" title="Чужая тема">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Delete Category Confirmation */}
          {confirmDeleteCatId && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-medium">Удалить тему и её клипы?</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCatId(null)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(confirmDeleteCatId)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Selected Category Videos */}
        <div className="md:col-span-8 space-y-4">
          {activeCategory ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/40 border border-white/[0.08] backdrop-blur-md">
              {/* Ownership Banner if not author */}
              {!canEditActiveCategory && (
                <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-200">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Тема доступна только для просмотра и игры. Автор:{' '}
                    <strong>@{activeCategory.authorName || 'Официально'}</strong>. Редактировать и добавлять клипы может только автор.
                  </span>
                </div>
              )}

              {/* Category Active Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  {activeCategory.imageUrl && (
                    <img
                      src={activeCategory.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-100">{activeCategory.title}</h3>
                      {activeCategory.authorName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                          @{activeCategory.authorName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {activeQuestions.length}{' '}
                      {activeQuestions.length === 1
                        ? 'видеоклип'
                        : activeQuestions.length <= 4
                        ? 'видеоклипа'
                        : 'видеоклипов'}
                    </p>
                  </div>
                </div>

                {/* Top action buttons */}
                <div className="flex items-center gap-2">
                  {activeQuestions.length > 0 && (
                    <button
                      onClick={() => onPlayCategory(activeCategory)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors focus:outline-none"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Тест</span>
                    </button>
                  )}

                  {canEditActiveCategory && (
                    <button
                      onClick={() => {
                        setEditingQuestion(null);
                        setIsVideoModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-sm transition-all focus:outline-none"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Добавить клип</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Questions List */}
              <div className="pt-4 space-y-2.5">
                {activeQuestions.length > 0 ? (
                  activeQuestions.map((q, idx) => {
                    const correctOpt = q.options.find((o) => o.id === q.correctOptionId);

                    return (
                      <div
                        key={q.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.06] hover:border-white/[0.14] transition-all gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center font-mono text-xs font-semibold text-zinc-300 shrink-0">
                            #{idx + 1}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-zinc-100 mb-0.5 truncate">
                              {q.title}
                            </h4>

                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {/* Clean monochrome stop badge */}
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-white/[0.08]">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                <span>Стоп: {q.pauseTime.toFixed(1)}с</span>
                              </span>

                              <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-white/[0.04]">
                                {q.options.length} вар.
                              </span>

                              {correctOpt && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 max-w-[200px] truncate">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{correctOpt.text}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls if can edit */}
                        {canEditActiveCategory ? (
                          <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveQuestion(idx, 'up')}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 transition-colors"
                              title="Выше"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === activeQuestions.length - 1}
                              onClick={() => moveQuestion(idx, 'down')}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 transition-colors"
                              title="Ниже"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuestion(q);
                                setIsVideoModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 self-end sm:self-center flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Только чтение
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 px-4 rounded-2xl bg-zinc-900/30 border border-dashed border-white/10">
                    <Film className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 mb-3">
                      В этой теме пока нет клипов
                    </p>
                    {canEditActiveCategory ? (
                      <button
                        onClick={() => {
                          setEditingQuestion(null);
                          setIsVideoModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-all focus:outline-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить клип</span>
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Только автор темы может загружать клипы</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-400 text-xs">Выберите или создайте тему</div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        initialCategory={editingCategory}
      />

      {/* Video Question Editor Modal */}
      {activeCategory && (
        <VideoEditorModal
          isOpen={isVideoModalOpen}
          categoryId={activeCategory.id}
          categoryTitle={activeCategory.title}
          onClose={() => setIsVideoModalOpen(false)}
          onSave={handleSaveQuestion}
          initialQuestion={editingQuestion}
        />
      )}
    </div>
  );
};
