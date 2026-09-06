import React, { useState } from 'react';
import { Plus, Search, HelpCircle, X } from 'lucide-react';
import { Category, VideoQuestion, CategoryStats } from '../types';
import { CategoryCard } from './CategoryCard';

interface CategoryListProps {
  categories: Category[];
  questions: VideoQuestion[];
  stats: Record<string, CategoryStats>;
  onSelectCategory: (category: Category) => void;
  onOpenAdminTab: () => void;
  onOpenAdminCategory: (categoryId: string) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  questions,
  stats,
  onSelectCategory,
  onOpenAdminTab,
  onOpenAdminCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = categories.filter((cat) => {
    const query = searchQuery.toLowerCase();
    return (
      cat.title.toLowerCase().includes(query) ||
      cat.description.toLowerCase().includes(query) ||
      (cat.tag && cat.tag.toLowerCase().includes(query))
    );
  });

  const getQuestionCount = (categoryId: string) => {
    return questions.filter((q) => q.categoryId === categoryId).length;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-16">
      {/* Sleek Minimal Controls Bar: Search & Quick Add */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск тем..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-zinc-900/70 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/15 transition-all backdrop-blur-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Очистить"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={onOpenAdminTab}
          className="inline-flex items-center gap-2 px-4 sm:px-4.5 py-2.5 rounded-2xl bg-zinc-800/90 hover:bg-zinc-750 text-zinc-200 hover:text-white border border-white/10 text-xs font-semibold transition-all backdrop-blur-md shadow-xs hover:scale-[1.02] active:scale-[0.98] focus:outline-none shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Создать тему</span>
        </button>
      </div>

      {/* Categories Grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              questionCount={getQuestionCount(category.id)}
              stats={stats[category.id]}
              onSelect={onSelectCategory}
              onOpenAdminCategory={onOpenAdminCategory}
            />
          ))}
        </div>
      ) : (
        <div className="relative max-w-xl mx-auto my-6 p-8 sm:p-12 rounded-3xl bg-zinc-900/40 border border-white/[0.08] backdrop-blur-xl shadow-2xl text-center flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle ambient light */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-zinc-300 shadow-xl mb-4.5">
            <HelpCircle className="w-8 h-8 text-zinc-300 stroke-[1.75]" />
          </div>

          <h3 className="relative text-xl font-bold text-white tracking-tight mb-2">
            {searchQuery ? 'Ничего не найдено' : 'Темы пока не созданы'}
          </h3>

          <p className="relative text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed mb-6 font-normal">
            {searchQuery
              ? 'Попробуйте изменить поисковый запрос или очистить фильтр, чтобы увидеть все доступные темы.'
              : 'Создайте первую тему с видеороликами, таймкодами пауз и вариантами ответов, чтобы начать играть с друзьями!'}
          </p>

          <button
            onClick={() => {
              if (searchQuery) {
                setSearchQuery('');
              } else {
                onOpenAdminTab();
              }
            }}
            className="relative inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold shadow-lg transition-all hover:scale-105 active:scale-95 focus:outline-none"
          >
            <Plus className="w-4 h-4 text-zinc-950 stroke-[2.5]" />
            <span>{searchQuery ? 'Очистить поиск' : 'Создать первую тему'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
