import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { db } from './db';

const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  '.env',
  'chbd-project.zip',
  '.aistudio',
  '.cache',
];

function shouldInclude(rootDir: string, filePath: string): boolean {
  const rel = path.relative(rootDir, filePath);
  if (!rel || rel === '') return true;

  for (const ign of IGNORE_PATTERNS) {
    if (rel === ign || rel.startsWith(ign + path.sep) || rel.includes(path.sep + ign + path.sep)) {
      return false;
    }
  }
  return true;
}

function addDirectoryToZip(dirPath: string, zipFolder: JSZip, rootDir: string) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    if (!shouldInclude(rootDir, fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const subFolder = zipFolder.folder(item);
      if (subFolder) {
        addDirectoryToZip(fullPath, subFolder, rootDir);
      }
    } else {
      const content = fs.readFileSync(fullPath);
      zipFolder.file(item, content);
    }
  }
}

export async function generateProjectZipBuffer(): Promise<Buffer> {
  const rootDir = process.cwd();
  const zip = new JSZip();

  // Add all files from root
  addDirectoryToZip(rootDir, zip, rootDir);

  // Ensure current live database state is included
  const currentCategories = db.getCategories();
  const currentQuestions = db.getQuestions();
  const currentStats = db.getStats();

  zip.file(
    'data/live_export.json',
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        categories: currentCategories,
        questions: currentQuestions,
        stats: currentStats,
      },
      null,
      2
    )
  );

  // Add detailed README in Russian
  zip.file(
    'КАК_ЗАПУСТИТЬ.md',
    `# 🎬 Шоу «Что было дальше?» (ЧБД) — Веб-игра

Полный исходный код интерактивной игры «Что было дальше?».
Включает клиентскую часть на React 19 + Tailwind CSS + Framer Motion, сервер на Node.js (Express), базу данных пользователей и видеовопросов.

---

## ⚠️ Как убрать кнопку «Скачать сайт» перед публикацией для игроков:

В файле \`src/components/Navbar.tsx\` найдите блок с комментарием:
\`\`\`tsx
/* ================================================================================= */
/* ⚠️ КНОПКА «СКАЧАТЬ САЙТ» (УДАЛИТЕ ЭТОТ БЛОК ПЕРЕД ДЕПЛОЕМ НА ХОСТИНГ ДЛЯ ИГРОКОВ) */
/* ================================================================================= */
\`\`\`
И просто удалите этот блок (кнопку \`<button id="nav-download-btn">...\`), чтобы обычные игроки не видели кнопку скачивания архива.

---

## 💻 Быстрый запуск на вашем компьютере:

1. Установите **Node.js** (версия 18 или новее) с сайта: https://nodejs.org/
2. Распакуйте этот архив в любую папку.
3. Откройте терминал (PowerShell / Terminal / CMD) в этой папке.
4. Установите зависимости:
   \`\`\`bash
   npm install
   \`\`\`
5. Запустите сайт:
   \`\`\`bash
   npm run dev
   \`\`\`
6. Откройте браузер по адресу: **http://localhost:3000**

---

## 🚀 Как выложить на бесплатный хостинг (Render / Railway):

1. Загрузите файлы проекта в свой репозиторий на **GitHub**.
2. Перейдите на **[Render.com](https://render.com)** или **[Railway.app](https://railway.app)**.
3. Нажмите **New** ➔ **Web Service** и подключите ваш GitHub репозиторий.
4. Укажите параметры:
   - **Build Command**: \`npm run build\`
   - **Start Command**: \`npm start\`
   - **Port**: \`3000\`
5. Хостинг запустит сайт и выдаст вам публичный адрес (например, \`https://chbd-game.onrender.com\`), которым можно делиться со всеми друзьями!
`
  );

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
