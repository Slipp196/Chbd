import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Flame,
  Film,
} from 'lucide-react';
import { Category, VideoQuestion, GameAnswerRecord } from '../types';
import { getVideoBlob } from '../services/db';
import {
  playSelectSound,
  playCorrectSound,
  playWrongSound,
  playPauseTriggerSound,
} from '../utils/sound';

interface GamePlayerProps {
  category: Category;
  questions: VideoQuestion[];
  onExit: () => void;
  onFinishGame: (finalScore: number, answersCount: { correct: number; total: number }) => void;
  onScoreUpdate?: (score: number) => void;
}

type PlaybackPhase = 'loading' | 'playing_before' | 'paused_question' | 'answered' | 'playing_after' | 'clip_ended';

export const GamePlayer: React.FC<GamePlayerProps> = ({
  category,
  questions,
  onExit,
  onFinishGame,
  onScoreUpdate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [phase, setPhase] = useState<PlaybackPhase>('loading');

  // Question & scoring state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answersHistory, setAnswersHistory] = useState<Record<string, GameAnswerRecord>>({});
  const [autoResumeTimer, setAutoResumeTimer] = useState<number | null>(null);

  // Load video source (IndexedDB Blob or Direct URL)
  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    async function loadSrc() {
      if (!currentQuestion) return;
      setPhase('loading');
      setSelectedOptionId(null);
      setCurrentTime(0);

      if (currentQuestion.videoBlobKey) {
        try {
          const blob = await getVideoBlob(currentQuestion.videoBlobKey);
          if (blob && active) {
            const url = URL.createObjectURL(blob);
            objectUrlToRevoke = url;
            setVideoSrc(url);
            return;
          }
        } catch (e) {
          console.error('Error loading video blob', e);
        }
      }

      if (active) {
        setVideoSrc(currentQuestion.videoUrl);
      }
    }

    loadSrc();

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      if (autoResumeTimer) {
        window.clearTimeout(autoResumeTimer);
      }
    };
  }, [currentQuestion]);

  // Sync score with parent
  useEffect(() => {
    if (onScoreUpdate) {
      onScoreUpdate(score);
    }
  }, [score, onScoreUpdate]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setPhase('playing_before');
    videoRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentQuestion) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // Stop at designated climax pause point
    if (phase === 'playing_before' && time >= currentQuestion.pauseTime) {
      videoRef.current.pause();
      setIsPlaying(false);
      setPhase('paused_question');
      playPauseTriggerSound();
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setPhase('clip_ended');
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (phase === 'paused_question') {
      return;
    }

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRestartClip = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setPhase('playing_before');
    videoRef.current.play();
    setIsPlaying(true);
  };

  // Option selection
  const handleOptionSelect = (optionId: string) => {
    if (phase !== 'paused_question' || selectedOptionId) return;

    setSelectedOptionId(optionId);
    playSelectSound();

    const isCorrect = optionId === currentQuestion.correctOptionId;

    if (isCorrect) {
      playCorrectSound();
      const points = 100 + streak * 20;
      setScore((prev) => prev + points);
      setStreak((prev) => prev + 1);
    } else {
      playWrongSound();
      setStreak(0);
    }

    setAnswersHistory((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        selectedOptionId: optionId,
        isCorrect,
      },
    }));

    setPhase('answered');

    // Auto-resume after 2.5 seconds to reveal what happened
    const timer = window.setTimeout(() => {
      resumePlaybackToRevealClimax();
    }, 2400);
    setAutoResumeTimer(timer);
  };

  const resumePlaybackToRevealClimax = () => {
    if (autoResumeTimer) {
      window.clearTimeout(autoResumeTimer);
      setAutoResumeTimer(null);
    }
    if (!videoRef.current) return;

    setPhase('playing_after');
    videoRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const handleNextQuestion = () => {
    if (autoResumeTimer) {
      window.clearTimeout(autoResumeTimer);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const totalAnswers = Object.values(answersHistory) as GameAnswerRecord[];
      const correctCount = totalAnswers.filter((a) => a.isCorrect).length;
      onFinishGame(score, {
        correct: correctCount,
        total: questions.length,
      });
    }
  };

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  if (!currentQuestion) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400 mb-4 text-sm">В этой категории пока нет видеоклипов.</p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100"
        >
          Вернуться к темам
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-12 flex flex-col items-center">
      {/* Player Header Info Bar */}
      <div className="w-full flex items-center justify-between gap-3 mb-3">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/70 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>К темам</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-zinc-900/70 border border-white/10 backdrop-blur-md text-xs text-zinc-300">
            <span>Клип {currentIndex + 1} из {questions.length}</span>
          </div>

          {streak > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-white/10 text-xs font-medium text-zinc-200">
              <Flame className="w-3.5 h-3.5 text-zinc-300" />
              <span>x{streak}</span>
            </div>
          )}

          {/* Score pill strictly here as user requested */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/70 border border-white/10 backdrop-blur-md text-xs font-semibold text-zinc-100">
            <Sparkles className="w-3 h-3 text-zinc-300" />
            <span>{score} очков</span>
          </div>
        </div>
      </div>

      {/* Segmented clip indicator */}
      <div
        className="w-full grid gap-1.5 mb-4"
        style={{ gridTemplateColumns: `repeat(${questions.length}, minmax(0, 1fr))` }}
      >
        {questions.map((q, idx) => {
          const ans = answersHistory[q.id];
          let barClass = 'bg-zinc-800';
          if (idx === currentIndex) {
            barClass = 'bg-zinc-200';
          } else if (ans) {
            barClass = ans.isCorrect ? 'bg-emerald-500' : 'bg-rose-500';
          }
          return (
            <div
              key={q.id}
              className={`h-1 rounded-full transition-all duration-300 ${barClass}`}
            />
          );
        })}
      </div>

      {/* Main Video & Answers Unified Container (Harmonious Zen Graphite Palette) */}
      <div className="w-full relative rounded-3xl overflow-hidden bg-zinc-900/60 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
        {/* Video Screen */}
        <div className="relative w-full aspect-video flex items-center justify-center bg-[#141416] overflow-hidden">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              muted={isVideoMuted}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlayPause}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs">
              <Film className="w-7 h-7 opacity-40 animate-pulse" />
              <span>Загрузка видео...</span>
            </div>
          )}

          {/* Play/Pause icon button overlay when paused manually */}
          {!isPlaying && phase !== 'paused_question' && phase !== 'answered' && videoSrc && (
            <button
              onClick={togglePlayPause}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-white/20 flex items-center justify-center text-white backdrop-blur-md transition-all transform hover:scale-105 shadow-xl"
            >
              <Play className="w-6 h-6 translate-x-0.5 fill-current" />
            </button>
          )}

          {/* Freeze alert badge at pause point */}
          <AnimatePresence>
            {(phase === 'paused_question' || phase === 'answered') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/85 border border-white/15 backdrop-blur-md text-xs font-medium text-zinc-200 shadow-lg"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Стоп-кадр</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* In-Video Minimal Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-zinc-950/80 via-zinc-950/30 to-transparent flex items-center justify-between gap-3 text-xs z-20">
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePlayPause}
                disabled={phase === 'paused_question'}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
                title={isPlaying ? 'Пауза' : 'Воспроизведение'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                onClick={handleRestartClip}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Сначала"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsVideoMuted(!isVideoMuted)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title={isVideoMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Custom scrubber with pause threshold */}
            <div className="flex-1 max-w-md mx-2 relative flex items-center">
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-zinc-200 transition-all duration-100"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {duration > 0 && currentQuestion && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-3 rounded-sm bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] pointer-events-none"
                  style={{
                    left: `${Math.min(100, Math.max(0, (currentQuestion.pauseTime / duration) * 100))}%`,
                  }}
                  title={`Точка стопа: ${currentQuestion.pauseTime.toFixed(1)}с`}
                />
              )}
            </div>

            <div className="text-[11px] font-mono text-zinc-300">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Dynamic Question & Answers Section */}
        <div className="p-5 sm:p-6 bg-zinc-900/40 border-t border-white/[0.06] backdrop-blur-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">
              {currentQuestion.prompt || 'Что было дальше?'}
            </h3>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentQuestion.options.map((option, idx) => {
              const letter = letters[idx] || `${idx + 1}`;
              const isSelected = selectedOptionId === option.id;
              const isCorrectAnswer = option.id === currentQuestion.correctOptionId;
              const hasAnswered = phase === 'answered' || phase === 'playing_after' || phase === 'clip_ended';

              let optionStyle =
                'bg-zinc-800/50 hover:bg-zinc-800/90 border-white/[0.08] hover:border-white/20 text-zinc-200';

              if (hasAnswered) {
                if (isCorrectAnswer) {
                  optionStyle =
                    'bg-emerald-500/15 border-emerald-500/60 text-emerald-200 shadow-sm';
                } else if (isSelected && !isCorrectAnswer) {
                  optionStyle =
                    'bg-rose-500/15 border-rose-500/60 text-rose-200 shadow-sm';
                } else {
                  optionStyle = 'bg-zinc-900/30 border-white/[0.04] text-zinc-400 opacity-60';
                }
              } else if (phase !== 'paused_question') {
                optionStyle = 'bg-zinc-800/30 border-white/[0.04] text-zinc-400 opacity-70 cursor-not-allowed';
              }

              return (
                <button
                  key={option.id}
                  id={`answer-option-${idx}`}
                  disabled={hasAnswered || phase !== 'paused_question'}
                  onClick={() => handleOptionSelect(option.id)}
                  className={`group relative flex items-center gap-3 p-3.5 rounded-2xl border text-left text-sm font-medium transition-all duration-200 focus:outline-none ${optionStyle}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                      hasAnswered && isCorrectAnswer
                        ? 'bg-emerald-500 text-zinc-950 font-bold'
                        : hasAnswered && isSelected && !isCorrectAnswer
                        ? 'bg-rose-500 text-white font-bold'
                        : 'bg-zinc-800 text-zinc-300 border border-white/10 group-hover:border-white/20'
                    }`}
                  >
                    {hasAnswered && isCorrectAnswer ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : hasAnswered && isSelected && !isCorrectAnswer ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      letter
                    )}
                  </div>

                  <span className="flex-1 leading-snug">{option.text}</span>
                </button>
              );
            })}
          </div>

          {/* Action Bar when answered */}
          {(phase === 'answered' || phase === 'playing_after' || phase === 'clip_ended') && (
            <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div className="text-xs">
                {selectedOptionId === currentQuestion.correctOptionId ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Верно! +100 очков
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    Не угадал
                  </span>
                )}
                {currentQuestion.explanation && (
                  <p className="text-zinc-400 mt-1 text-xs">
                    {currentQuestion.explanation}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {phase === 'answered' && (
                  <button
                    onClick={resumePlaybackToRevealClimax}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-all shadow-md focus:outline-none"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Смотреть развязку</span>
                  </button>
                )}

                {(phase === 'playing_after' || phase === 'clip_ended') && (
                  <button
                    id="btn-next-clip"
                    onClick={handleNextQuestion}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-all shadow-md focus:outline-none"
                  >
                    <span>{currentIndex < questions.length - 1 ? 'Дальше' : 'Итоги'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
