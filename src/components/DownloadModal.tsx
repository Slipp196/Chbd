import React, { useState } from 'react';
import {
  Download,
  FileArchive,
  FileCode,
  Terminal,
  Check,
  Loader2,
  X,
  ExternalLink,
  HardDrive,
  Copy,
  Info,
} from 'lucide-react';
import JSZip from 'jszip';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [jsonSuccess, setJsonSuccess] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    if (isDownloadingZip) return;
    setIsDownloadingZip(true);
    setZipSuccess(false);

    try {
      // 1. Try downloading directly from server API
      const res = await fetch('/api/download-project');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chbd-full-project.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setZipSuccess(true);
        setTimeout(() => setZipSuccess(false), 4000);
        return;
      }

      // 2. Client fallback via /public/chbd-project.zip + JSZip
      const fallbackRes = await fetch('/chbd-project.zip');
      if (!fallbackRes.ok) {
        throw new Error('Архив не найден');
      }
      const arrayBuffer = await fallbackRes.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Embed any current local items
      const storedCategories = localStorage.getItem('chbd_categories_v2');
      const storedQuestions = localStorage.getItem('chbd_questions_v2');
      const storedStats = localStorage.getItem('chbd_category_stats_v1');

      if (storedCategories || storedQuestions) {
        zip.file(
          'data/client_local_data.json',
          JSON.stringify(
            {
              savedAt: new Date().toISOString(),
              categories: storedCategories ? JSON.parse(storedCategories) : [],
              questions: storedQuestions ? JSON.parse(storedQuestions) : [],
              stats: storedStats ? JSON.parse(storedStats) : {},
            },
            null,
            2
          )
        );
      }

      const generatedBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const blobUrl = URL.createObjectURL(generatedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = 'chbd-full-project.zip';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 4000);
    } catch (err) {
      console.error('Download error:', err);
      // Direct window location fallback
      window.location.href = '/chbd-project.zip';
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadJson = async () => {
    if (isDownloadingJson) return;
    setIsDownloadingJson(true);
    setJsonSuccess(false);

    try {
      const res = await fetch('/api/export-data');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chbd-database.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setJsonSuccess(true);
        setTimeout(() => setJsonSuccess(false), 4000);
        return;
      }

      // Fallback: local storage export
      const data = {
        categories: JSON.parse(localStorage.getItem('chbd_categories_v2') || '[]'),
        questions: JSON.parse(localStorage.getItem('chbd_questions_v2') || '[]'),
        stats: JSON.parse(localStorage.getItem('chbd_category_stats_v1') || '{}'),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chbd-database.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setJsonSuccess(true);
      setTimeout(() => setJsonSuccess(false), 4000);
    } catch (err) {
      console.error('Export JSON error:', err);
    } finally {
      setIsDownloadingJson(false);
    }
  };

  const copyRunCommand = () => {
    navigator.clipboard.writeText('npm install && npm run dev');
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden relative text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-200">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Скачать весь проект
              </h3>
              <p className="text-xs text-zinc-400">
                Полный исходный код, сервер, база данных и медиафайлы
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Options */}
        <div className="py-5 space-y-3">
          {/* Main Option: Complete ZIP */}
          <div className="p-4 rounded-2xl bg-zinc-800/60 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white">Весь сайт (.ZIP архив)</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
                    ~2.6 МБ
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  React 19, Node.js сервер (Express), Tailwind CSS, все темы, видеовопросы и инструкция.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition-all focus:outline-none ${
                zipSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm active:scale-95'
              }`}
            >
              {isDownloadingZip ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Сборка...</span>
                </>
              ) : zipSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Скачано!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать ZIP</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Option: JSON Data Only */}
          <div className="p-4 rounded-2xl bg-zinc-800/40 border border-white/[0.06] hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Только база данных (.JSON)</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Все созданные темы, клипы, паузы, правильные ответы и статистика игроков.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadJson}
              disabled={isDownloadingJson}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 border border-white/10 transition-all focus:outline-none ${
                jsonSuccess
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              {isDownloadingJson ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : jsonSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Готово!</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Экспорт JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Guide on how to run locally */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/[0.08] space-y-2 text-xs">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-1.5 font-medium text-[11px] text-zinc-400 uppercase tracking-wider">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              Как запустить сайт у себя на компьютере:
            </span>
            <button
              onClick={copyRunCommand}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {copiedCommand ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Копировать команду</span>
                </>
              )}
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 font-mono text-[11px] text-zinc-300 flex items-center justify-between overflow-x-auto">
            <code>npm install && npm run dev</code>
          </div>

          <p className="text-[11px] text-zinc-400 leading-normal">
            Распакуйте ZIP, откройте терминал в папке и запустите команду. Сайт откроется на <strong className="text-zinc-300 font-mono">http://localhost:3000</strong>.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            В архиве также есть файл <code>КАК_ЗАПУСТИТЬ.md</code>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
