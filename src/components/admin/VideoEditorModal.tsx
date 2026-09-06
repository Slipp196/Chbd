import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  Play,
  Pause,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { VideoQuestion, AnswerOption } from '../../types';
import { storeVideoBlob, getVideoBlob } from '../../services/db';
import { resolveTwitchClip, extractTwitchClipSlug } from '../../utils/twitch';
import { api } from '../../services/api';

interface VideoEditorModalProps {
  isOpen: boolean;
  categoryId: string;
  categoryTitle: string;
  onClose: () => void;
  onSave: (question: VideoQuestion) => void;
  initialQuestion?: VideoQuestion | null;
}

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  categoryId,
  categoryTitle,
  onClose,
  onSave,
  initialQuestion,
}) => {
  const [sourceType, setSourceType] = useState<'url' | 'file'>('url');
  const [inputUrl, setInputUrl] = useState<string>(initialQuestion?.videoUrl || '');
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>(initialQuestion?.videoUrl || '');
  const [isResolvingTwitch, setIsResolvingTwitch] = useState(false);
  const [twitchStatus, setTwitchStatus] = useState<string | null>(null);

  const [blobKey, setBlobKey] = useState<string | undefined>(initialQuestion?.videoBlobKey);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');

  const [title, setTitle] = useState(initialQuestion?.title || '');
  const [prompt, setPrompt] = useState(initialQuestion?.prompt || 'Что было дальше?');
  const [explanation, setExplanation] = useState(initialQuestion?.explanation || '');
  const [pauseTime, setPauseTime] = useState<number>(initialQuestion?.pauseTime || 5.0);

  // Dynamic Options list
  const [options, setOptions] = useState<AnswerOption[]>(
    initialQuestion?.options || [
      { id: 'opt_1', text: '' },
      { id: 'opt_2', text: '' },
      { id: 'opt_3', text: '' },
    ]
  );
  const [correctOptionId, setCorrectOptionId] = useState<string>(
    initialQuestion?.correctOptionId || 'opt_1'
  );

  // Video scrubber state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTestingPause, setIsTestingPause] = useState(false);
  const [isUploadingServer, setIsUploadingServer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing blob or url
  useEffect(() => {
    let active = true;
    if (initialQuestion?.videoBlobKey) {
      setSourceType('file');
      getVideoBlob(initialQuestion.videoBlobKey).then((blob) => {
        if (blob && active) {
          setVideoBlob(blob);
          const objUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(objUrl);
        }
      });
    } else if (initialQuestion?.videoUrl) {
      setSourceType('url');
      setInputUrl(initialQuestion.videoUrl);
      setResolvedVideoUrl(initialQuestion.videoUrl);
    } else {
      setSourceType('url');
    }

    return () => {
      active = false;
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [initialQuestion]);

  if (!isOpen) return null;

  const currentVideoSrc = previewBlobUrl || resolvedVideoUrl;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Выберите видеофайл (MP4, WebM, MOV)');
      return;
    }

    setErrorMessage(null);
    setVideoBlob(file);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setPreviewBlobUrl(objUrl);
    setSourceType('file');
  };

  // Handle URL change, detect Twitch links automatically
  const handleUrlChange = async (val: string) => {
    setInputUrl(val);
    setErrorMessage(null);
    const trimmed = val.trim();

    if (!trimmed) {
      setResolvedVideoUrl('');
      setTwitchStatus(null);
      return;
    }

    // Check if Twitch clip link
    if (extractTwitchClipSlug(trimmed)) {
      setIsResolvingTwitch(true);
      setTwitchStatus('Подключение к клипу Twitch...');
      try {
        const resolved = await resolveTwitchClip(trimmed);
        if (resolved && resolved.mp4Url) {
          setResolvedVideoUrl(resolved.mp4Url);
          setTwitchStatus('Клип Twitch подключен');
          if (!title.trim() && resolved.title) {
            setTitle(resolved.title);
          }
        } else {
          setTwitchStatus('Не удалось открыть клип Twitch. Проверьте ссылку');
          setResolvedVideoUrl(trimmed);
        }
      } catch (err) {
        console.error(err);
        setTwitchStatus('Ошибка загрузки клипа Twitch');
        setResolvedVideoUrl(trimmed);
      } finally {
        setIsResolvingTwitch(false);
      }
    } else {
      setTwitchStatus(null);
      setResolvedVideoUrl(trimmed);
    }
  };

  // Video playback
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    if (isTestingPause && time >= pauseTime) {
      videoRef.current.pause();
      setIsPlaying(false);
      setIsTestingPause(false);
    }
  };

  const setPauseAtCurrentTime = () => {
    if (!videoRef.current) return;
    const time = parseFloat(videoRef.current.currentTime.toFixed(1));
    setPauseTime(time);
  };

  const testPauseFromStart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setIsTestingPause(true);
    videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
  };

  // Options management
  const handleAddOption = () => {
    const newId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOption: AnswerOption = {
      id: newId,
      text: '',
    };
    setOptions((prev) => [...prev, newOption]);
    if (options.length === 0) {
      setCorrectOptionId(newId);
    }
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 1) {
      setErrorMessage('В вопросе должен быть хотя бы один вариант');
      return;
    }
    const filtered = options.filter((opt) => opt.id !== id);
    setOptions(filtered);
    if (correctOptionId === id && filtered.length > 0) {
      setCorrectOptionId(filtered[0].id);
    }
  };

  const handleOptionTextChange = (id: string, text: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, text } : opt))
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMessage('Укажите название момента');
      return;
    }
    if (!currentVideoSrc) {
      setErrorMessage('Укажите ссылку на видео или загрузите файл');
      return;
    }
    if (options.length === 0 || options.some((opt) => !opt.text.trim())) {
      setErrorMessage('Заполните все варианты ответа');
      return;
    }
    if (!correctOptionId || !options.find((opt) => opt.id === correctOptionId)) {
      setErrorMessage('Выберите верный вариант ответа');
      return;
    }

    let savedBlobKey = blobKey;
    let finalVideoUrl = resolvedVideoUrl || inputUrl.trim();

    if (videoBlob) {
      setIsUploadingServer(true);
      try {
        const uploadRes = await api.media.uploadVideo(videoBlob, (videoBlob as File).name || 'clip.mp4');
        if (uploadRes && uploadRes.url) {
          finalVideoUrl = uploadRes.url;
        }
      } catch (uploadErr) {
        console.warn('Video server upload warning, fallback to indexedDB:', uploadErr);
      } finally {
        setIsUploadingServer(false);
      }

      savedBlobKey = savedBlobKey || `video_blob_${Date.now()}`;
      try {
        await storeVideoBlob(savedBlobKey, videoBlob);
      } catch (e) {
        console.error('Failed to store video blob', e);
      }
    }

    const questionData: VideoQuestion = {
      id: initialQuestion?.id || `q_${Date.now()}`,
      categoryId,
      title: title.trim(),
      prompt: prompt.trim() || 'Что было дальше?',
      videoUrl: finalVideoUrl,
      videoBlobKey: savedBlobKey,
      pauseTime: pauseTime,
      options: options.map((opt) => ({ ...opt, text: opt.text.trim() })),
      correctOptionId,
      explanation: explanation.trim(),
      createdAt: initialQuestion?.createdAt || Date.now(),
    };

    onSave(questionData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#161618] border border-white/10 shadow-2xl text-zinc-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-zinc-900/40">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              {initialQuestion ? 'Редактировать клип' : 'Добавить клип'}
            </h3>
            <span className="text-[11px] text-zinc-400">
              {categoryTitle}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Video Source Switcher */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Видео
              </label>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs">
                <button
                  type="button"
                  onClick={() => setSourceType('url')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    sourceType === 'url'
                      ? 'bg-zinc-800 text-white font-medium shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Ссылка / Twitch
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('file')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    sourceType === 'file'
                      ? 'bg-zinc-800 text-white font-medium shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Загрузить файл
                </button>
              </div>
            </div>

            {sourceType === 'url' ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="Вставьте ссылку на клип Twitch или прямой URL видео..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  {isResolvingTwitch && (
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {twitchStatus && (
                  <p className="text-[11px] text-zinc-400 px-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 inline-block" />
                    {twitchStatus}
                  </p>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all text-center cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-zinc-200">
                  {videoBlob ? 'Заменить видеофайл' : 'Выбрать видеофайл с устройства'}
                </p>
                {videoBlob && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-white/10 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Файл загружен ({(videoBlob.size / (1024 * 1024)).toFixed(1)} МБ)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Video Preview & Pause Setup (Clean Monochrome / No Yellow) */}
          <div className="space-y-3 pt-3 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Момент остановки
              </label>
              <div className="text-xs font-mono text-zinc-200 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/10">
                Остановка на: <span className="font-semibold text-white">{pauseTime.toFixed(1)}с</span>
              </div>
            </div>

            {/* Video Stage */}
            <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-white/10 shadow-lg aspect-video max-h-[280px] mx-auto flex items-center justify-center">
              {currentVideoSrc ? (
                <video
                  ref={videoRef}
                  src={currentVideoSrc}
                  playsInline
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                />
              ) : (
                <div className="text-xs text-zinc-400 flex flex-col items-center gap-1">
                  <span>Укажите видео для предпросмотра</span>
                </div>
              )}

              {/* Pause point alert in player - Clean neutral floating badge */}
              {Math.abs(currentTime - pauseTime) < 0.25 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-white/20 text-zinc-100 text-[11px] font-medium backdrop-blur-md shadow-md">
                  Точка паузы ({pauseTime.toFixed(1)}с)
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
              {/* Slider with marker in clean pure white */}
              <div className="relative flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 10}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    if (videoRef.current) {
                      videoRef.current.currentTime = t;
                    }
                    setCurrentTime(t);
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                />

                {/* Visual marker pin on slider - Clean white indicator */}
                {duration > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-3.5 rounded-sm bg-white pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    style={{ left: `${(pauseTime / duration) * 100}%` }}
                    title={`Пауза: ${pauseTime.toFixed(1)}с`}
                  />
                )}
              </div>

              {/* Action Buttons: Play/Pause, time, Test Pause, Set Pause */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Пауза' : 'Смотреть'}</span>
                  </button>

                  <span className="font-mono text-zinc-400 pl-1 text-[11px]">
                    {currentTime.toFixed(1)}с / {duration.toFixed(1)}с
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={testPauseFromStart}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Проверить остановку</span>
                  </button>

                  <button
                    type="button"
                    onClick={setPauseAtCurrentTime}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Поставить паузу здесь ({currentTime.toFixed(1)}с)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Question and options */}
          <div className="space-y-3.5 pt-3 border-t border-white/[0.08]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Название момента <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Момент на шоссе"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Вопрос
                </label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Что было дальше?"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  Варианты ответа
                </span>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-white/10 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {options.map((opt, idx) => {
                  const isCorrect = correctOptionId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        isCorrect
                          ? 'bg-zinc-800/90 border-white/30 text-white'
                          : 'bg-zinc-900/60 border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectOptionId(opt.id)}
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isCorrect
                            ? 'bg-white text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                        title={isCorrect ? 'Верный ответ' : 'Сделать верным'}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-[10px] font-semibold">{idx + 1}</span>
                        )}
                      </button>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionTextChange(opt.id, e.target.value)}
                        placeholder={`Вариант ${idx + 1}...`}
                        className="flex-1 bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt.id)}
                        className="p-1 text-zinc-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Пояснение к развязке
              </label>
              <input
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Что произошло в финале клипа..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] flex items-center justify-between shrink-0 bg-zinc-900/40">
          <span className="text-[11px] text-zinc-400">
            {options.length} вар. • пауза {pauseTime.toFixed(1)}с
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isUploadingServer}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 text-xs font-semibold shadow-md transition-all focus:outline-none"
            >
              {isUploadingServer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isUploadingServer ? 'Загрузка видео...' : initialQuestion ? 'Сохранить' : 'Добавить'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
