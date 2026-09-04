import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, AlertCircle } from 'lucide-react';
import { Category } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryData: Omit<Category, 'createdAt'> & { id?: string }) => void;
  initialCategory?: Category | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCategory,
}) => {
  const [title, setTitle] = useState(initialCategory?.title || '');
  const [description, setDescription] = useState(initialCategory?.description || '');
  const [tag, setTag] = useState(initialCategory?.tag || '');
  const [imageUrl, setImageUrl] = useState<string>(initialCategory?.imageUrl || '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Укажите название темы');
      return;
    }

    onSave({
      id: initialCategory?.id,
      title: title.trim(),
      description: description.trim(),
      tag: tag.trim() || 'ЧБД',
      imageUrl: imageUrl.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-[#161618] border border-white/10 p-6 shadow-2xl relative text-zinc-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-semibold mb-4 text-zinc-100">
          {initialCategory ? 'Редактировать тему' : 'Новая тема'}
        </h3>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Cover Image Upload Only */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Обложка
            </label>

            {imageUrl ? (
              <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/15 group bg-zinc-900">
                <img
                  src={imageUrl}
                  alt="Обложка"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-xs text-white border border-white/20 transition-colors"
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-28 rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer p-3"
              >
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-zinc-300">Загрузить изображение</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Title with Styled Error instead of browser popup */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Название темы
              </label>
              {titleError && (
                <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {titleError}
                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="Например: Моменты со стримов"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none transition-colors ${
                titleError
                  ? 'border-rose-500/60 focus:border-rose-500'
                  : 'border-white/10 focus:border-white/30'
              }`}
            />
          </div>

          {/* Tag */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Тег
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Стримы, Фейлы..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Краткое описание
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание темы..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-md transition-all focus:outline-none"
            >
              {initialCategory ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
