import React from 'react';
import { Film, Trophy, ArrowRight, Play } from 'lucide-react';
import { Category, CategoryStats } from '../types';

interface CategoryCardProps {
  category: Category;
  questionCount: number;
  stats?: CategoryStats;
  onSelect: (category: Category) => void;
  onOpenAdminCategory?: (categoryId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  questionCount,
  stats,
  onSelect,
}) => {
  const hasQuestions = questionCount > 0;

  return (
    <div
      onClick={() => hasQuestions && onSelect(category)}
      className={`group relative flex flex-col justify-between rounded-3xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/[0.08] hover:border-white/20 transition-all duration-300 cursor-pointer backdrop-blur-md overflow-hidden ${
        !hasQuestions ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {/* Category Cover Image Header */}
      <div className="relative w-full h-40 bg-zinc-800 overflow-hidden">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
            <span className="text-2xl font-black text-white/10 tracking-widest uppercase">ЧБД</span>
          </div>
        )}

        {/* Ambient Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/30 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {category.tag && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-200">
                {category.tag}
              </span>
            )}
            {category.authorName && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-300">
                by {category.authorName}
              </span>
            )}
          </div>

          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10 flex items-center gap-1">
            <Film className="w-3 h-3 text-zinc-400" />
            {questionCount} {questionCount === 1 ? 'клип' : questionCount >= 2 && questionCount <= 4 ? 'клипа' : 'клипов'}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1.5">
            {category.title}
          </h3>
          {category.description && (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {category.description}
            </p>
          )}
        </div>

        {/* Bottom meta & play button */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
          {stats && stats.timesPlayed > 0 ? (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Trophy className="w-3.5 h-3.5 text-zinc-300" />
              <span className="text-[11px]">{stats.bestScore} очков</span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400">Новая игра</span>
          )}

          <div className="flex items-center gap-1 text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
            <span>{hasQuestions ? 'Играть' : 'Пусто'}</span>
            {hasQuestions ? (
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <Play className="w-3.5 h-3.5 opacity-30" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
