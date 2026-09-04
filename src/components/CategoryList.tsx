import React, { useState } from 'react';
import { Plus, Search, HelpCircle } from 'lucide-react';
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-12">
      {/* Sleek Minimal Controls Bar: Search & Quick Add */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск тем..."
            className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900/60 border border-white/[0.08] text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/20 transition-all backdrop-blur-md"
          />
        </div>

        <button
          onClick={onOpenAdminTab}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 hover:text-white border border-white/10 text-xs font-medium transition-all backdrop-blur-md shadow-sm focus:outline-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Создать тему</span>
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
        <div className="text-center py-20 px-4 rounded-3xl bg-zinc-900/30 border border-dashed border-white/10 max-w-lg mx-auto">
          <HelpCircle className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200 mb-1.5">
            {searchQuery ? 'Ничего не найдено' : 'Темы пока не созданы'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? 'Попробуйте изменить поисковый запрос'
              : 'Создайте первую тему с видеороликами, таймкодами пауз и вариантами ответов, чтобы начать играть с друзьями!'}
          </p>
          <button
            onClick={onOpenAdminTab}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-md transition-all focus:outline-none"
          >
            <Plus className="w-4 h-4" />
            <span>Создать первую тему</span>
          </button>
        </div>
      )}
    </div>
  );
};
