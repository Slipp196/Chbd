import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, ArrowLeft, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { Category } from '../types';

interface GameCompleteModalProps {
  category: Category;
  score: number;
  correctCount: number;
  totalCount: number;
  onPlayAgain: () => void;
  onExitToCategories: () => void;
  onOpenAdmin: () => void;
}

export const GameCompleteModal: React.FC<GameCompleteModalProps> = ({
  score,
  correctCount,
  totalCount,
  onPlayAgain,
  onExitToCategories,
  onOpenAdmin,
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#34d399', '#f43f5e', '#ffffff'],
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12 flex flex-col items-center text-center">
      <div className="w-full p-8 rounded-3xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight mb-6">
            Игра завершена
          </h2>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 w-full mb-5">
            <div className="p-4 rounded-2xl bg-zinc-800/50 border border-white/[0.06]">
              <span className="text-xs text-zinc-400 block mb-1">Итоговый счет</span>
              <span className="text-2xl font-bold text-zinc-100 font-mono flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-zinc-300" />
                {score}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-800/50 border border-white/[0.06]">
              <span className="text-xs text-zinc-400 block mb-1">Точность</span>
              <span className="text-2xl font-bold text-zinc-100 font-mono">
                {percentage}%
              </span>
            </div>
          </div>

          {/* Breakdown pill */}
          <div className="inline-flex items-center gap-4 px-4 py-2 rounded-xl bg-zinc-950/60 border border-white/[0.06] text-xs text-zinc-300 mb-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Верно: {correctCount}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-600" />
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <XCircle className="w-3.5 h-3.5" />
              Не угадано: {totalCount - correctCount}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={onPlayAgain}
              className="w-full py-3 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сыграть ещё раз</span>
            </button>

            <button
              onClick={onExitToCategories}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 font-medium text-xs border border-white/[0.08] transition-all flex items-center justify-center gap-2 focus:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>К темам</span>
            </button>

            <button
              onClick={onOpenAdmin}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 font-medium text-xs transition-all flex items-center justify-center gap-2 focus:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать ЧБД</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
