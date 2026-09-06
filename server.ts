import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { generateProjectZipBuffer } from './server/pack';
import { User } from './src/types';

interface AuthenticatedRequest extends Request {
  user?: User;
}

// Authentication middleware to extract user from Bearer token
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  const user = db.getUserByToken(token);
  if (user) {
    req.user = user;
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Необходимо авторизоваться для выполнения этого действия' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(authMiddleware);

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Upload video directly to server (persists across devices and users)
  app.post('/api/upload-video', (req: Request, res: Response) => {
    try {
      const originalName = decodeURIComponent((req.headers['x-filename'] as string) || 'clip.mp4');
      const ext = path.extname(originalName) || '.mp4';
      const safeExt = ['.mp4', '.webm', '.mov', '.ogg', '.m4v'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.mp4';
      const filename = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${safeExt}`;
      const filePath = path.join(uploadsDir, filename);

      const writeStream = fs.createWriteStream(filePath);
      req.pipe(writeStream);

      writeStream.on('finish', () => {
        const publicUrl = `/uploads/${filename}`;
        res.json({ success: true, url: publicUrl, filename });
      });

      writeStream.on('error', (err) => {
        console.error('Error saving uploaded video:', err);
        res.status(500).json({ error: 'Ошибка сохранения видеофайла на сервере' });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка загрузки видео' });
    }
  });

  // Resolve Twitch clips server-side (bypasses browser CORS & restrictions)
  app.get('/api/twitch/resolve', async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        res.status(400).json({ error: 'Параметр url обязателен' });
        return;
      }

      // Extract slug
      let slug = '';
      const clipsTvMatch = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/i);
      if (clipsTvMatch && clipsTvMatch[1]) {
        slug = clipsTvMatch[1];
      } else {
        const twitchTvMatch = url.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/i) ||
                              url.match(/twitch\.tv\/clips\/([A-Za-z0-9_-]+)/i);
        if (twitchTvMatch && twitchTvMatch[1]) {
          slug = twitchTvMatch[1];
        } else if (/^[A-Za-z0-9_-]{10,}$/.test(url.trim())) {
          slug = url.trim();
        }
      }

      if (!slug) {
        res.status(400).json({ error: 'Не удалось определить идентификатор клипа Twitch' });
        return;
      }

      const payload = [
        {
          variables: { slug },
          query: `query($slug: ID!) {
            clip(slug: $slug) {
              id
              title
              playbackAccessToken(params: { platform: "web", playerType: "site" }) {
                signature
                value
              }
              videoQualities {
                quality
                sourceURL
              }
            }
          }`,
        },
      ];

      const twitchRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!twitchRes.ok) {
        throw new Error(`Twitch API status ${twitchRes.status}`);
      }

      const data: any = await twitchRes.json();
      const clip = data?.[0]?.data?.clip;
      if (!clip || !clip.videoQualities || clip.videoQualities.length === 0) {
        res.status(404).json({ error: 'Клип не найден или приватный' });
        return;
      }

      const bestQuality = clip.videoQualities[0];
      const signature = clip.playbackAccessToken?.signature;
      const value = clip.playbackAccessToken?.value;

      let mp4Url = bestQuality.sourceURL;
      if (signature && value) {
        const glue = mp4Url.includes('?') ? '&' : '?';
        mp4Url = `${mp4Url}${glue}sig=${signature}&token=${encodeURIComponent(value)}`;
      }

      res.json({
        mp4Url,
        title: clip.title || '',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ошибка обработки клипа Twitch' });
    }
  });

  // Auth: Register
  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const result = db.registerUser(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка регистрации' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const result = db.loginUser(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Ошибка входа' });
    }
  });

  // Auth: Current User
  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });

  // Profile: Update bio, avatarUrl, bannerUrl
  app.put('/api/user/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updatedUser = db.updateProfile(req.user!.id, req.body);
      res.json({ user: updatedUser });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка обновления профиля' });
    }
  });

  // Auth: Logout
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.logoutUser(token);
    }
    res.json({ success: true });
  });

  // Categories: Get with privacy filter & admin view mode
  app.get('/api/categories', (req: AuthenticatedRequest, res: Response) => {
    const viewMode = (req.query.viewMode as string) === 'user_preview' ? 'user_preview' : 'admin';
    const categories = db.getCategories(req.user || null, viewMode);
    res.json(categories);
  });

  // Categories: Create (with or without auth)
  app.post('/api/categories', (req: AuthenticatedRequest, res: Response) => {
    try {
      const newCategory = db.createCategory(req.body, req.user || null);
      res.status(201).json(newCategory);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Не удалось создать категорию' });
    }
  });

  // Categories: Update
  app.put('/api/categories/:id', (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = db.updateCategory(req.params.id, req.body, req.user || null);
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка обновления категории' });
    }
  });

  // Categories: Delete (or mark removed_by_admin)
  app.delete('/api/categories/:id', (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = db.deleteCategory(req.params.id, req.user || null);
      res.json({ success: true, id: req.params.id, ...result });
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка удаления категории' });
    }
  });

  // Categories: Sync array (Bulk replace / sync)
  app.post('/api/categories/sync', (req: Request, res: Response) => {
    try {
      const { categories } = req.body;
      const result = db.setCategories(categories);
      res.json({ success: true, categories: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка синхронизации тем' });
    }
  });

  // Questions: Get all or by categoryId
  app.get('/api/questions', (req: Request, res: Response) => {
    const categoryId = req.query.categoryId as string | undefined;
    const questions = db.getQuestions(categoryId);
    res.json(questions);
  });

  // Questions: Create (with or without auth)
  app.post('/api/questions', (req: AuthenticatedRequest, res: Response) => {
    try {
      const newQuestion = db.createQuestion(req.body, req.user || null);
      res.status(201).json(newQuestion);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Не удалось сохранить клип' });
    }
  });

  // Questions: Update
  app.put('/api/questions/:id', (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = db.updateQuestion(req.params.id, req.body, req.user || null);
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка обновления клипа' });
    }
  });

  // Questions: Delete
  app.delete('/api/questions/:id', (req: AuthenticatedRequest, res: Response) => {
    try {
      db.deleteQuestion(req.params.id, req.user || null);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка удаления клипа' });
    }
  });

  // Questions: Sync array
  app.post('/api/questions/sync', (req: Request, res: Response) => {
    try {
      const { questions } = req.body;
      const result = db.setQuestions(questions);
      res.json({ success: true, questions: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка синхронизации клипов' });
    }
  });

  // Global Sync: Categories + Questions in one atomic write
  app.post('/api/sync-all', (req: Request, res: Response) => {
    try {
      const { categories, questions } = req.body;
      if (Array.isArray(categories)) db.setCategories(categories);
      if (Array.isArray(questions)) db.setQuestions(questions);
      res.json({ success: true, categories: db.getCategories(), questions: db.getQuestions() });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Ошибка сохранения' });
    }
  });

  // Stats: Get
  app.get('/api/stats', (req: Request, res: Response) => {
    res.json(db.getStats());
  });

  // Stats: Update
  app.post('/api/stats/:categoryId', (req: Request, res: Response) => {
    const { score } = req.body;
    db.updateStats(req.params.categoryId, typeof score === 'number' ? score : 0);
    res.json({ success: true });
  });

  // Download entire website source code & database as ZIP archive
  app.get('/api/download-project', async (req: Request, res: Response) => {
    try {
      const zipBuffer = await generateProjectZipBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="chbd-full-project.zip"');
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Error creating project zip:', err);
      // Fallback: if public/chbd-project.zip exists, send that
      const fallbackPath = path.join(process.cwd(), 'public', 'chbd-project.zip');
      if (fs.existsSync(fallbackPath)) {
        res.download(fallbackPath, 'chbd-full-project.zip');
      } else {
        res.status(500).json({ error: 'Не удалось сформировать архив проекта' });
      }
    }
  });

  // Export database and content as JSON
  app.get('/api/export-data', (req: Request, res: Response) => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        categories: db.getCategories(),
        questions: db.getQuestions(),
        stats: db.getStats(),
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="chbd-data.json"');
      res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: 'Ошибка экспорта данных' });
    }
  });

  // --- Vite Dev Middleware or Production Static Fallback ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
