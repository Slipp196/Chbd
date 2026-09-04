import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
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

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(authMiddleware);

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
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

  // Auth: Logout
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.logoutUser(token);
    }
    res.json({ success: true });
  });

  // Categories: Get all
  app.get('/api/categories', (req: Request, res: Response) => {
    const categories = db.getCategories();
    res.json(categories);
  });

  // Categories: Create (Requires auth)
  app.post('/api/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const newCategory = db.createCategory(req.body, req.user!);
      res.status(201).json(newCategory);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Не удалось создать категорию' });
    }
  });

  // Categories: Update (Requires author)
  app.put('/api/categories/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = db.updateCategory(req.params.id, req.body, req.user!);
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка обновления категории' });
    }
  });

  // Categories: Delete (Requires author)
  app.delete('/api/categories/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      db.deleteCategory(req.params.id, req.user!);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка удаления категории' });
    }
  });

  // Questions: Get all or by categoryId
  app.get('/api/questions', (req: Request, res: Response) => {
    const categoryId = req.query.categoryId as string | undefined;
    const questions = db.getQuestions(categoryId);
    res.json(questions);
  });

  // Questions: Create (Requires author of category)
  app.post('/api/questions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const newQuestion = db.createQuestion(req.body, req.user!);
      res.status(201).json(newQuestion);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Не удалось сохранить клип' });
    }
  });

  // Questions: Update (Requires author of category)
  app.put('/api/questions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = db.updateQuestion(req.params.id, req.body, req.user!);
      res.json(updated);
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка обновления клипа' });
    }
  });

  // Questions: Delete (Requires author of category)
  app.delete('/api/questions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      db.deleteQuestion(req.params.id, req.user!);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      const status = err.message?.includes('Только автор') ? 403 : 400;
      res.status(status).json({ error: err.message || 'Ошибка удаления клипа' });
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
