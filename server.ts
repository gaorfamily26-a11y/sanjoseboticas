import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Odoo Proxy Route
  const ALLOWED_HOST = "mitienda.facturaclic.pe";

  app.post('/api/odoo-proxy', async (req, res) => {
    try {
      const { url, body } = req.body;

      if (!url || !body) {
        return res.status(400).json({ error: 'Missing url or body' });
      }

      const targetUrl = new URL(url);
      if (targetUrl.hostname !== ALLOWED_HOST) {
        return res.status(403).json({ error: 'Unauthorized target host' });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Accept': 'text/xml',
          'User-Agent': 'Odoo-Operations-Hub/1.0',
        },
        body: body,
      });

      const data = await response.text();
      
      res.status(response.status)
         .set('Content-Type', 'text/xml')
         .set('Access-Control-Allow-Origin', '*')
         .set('Cache-Control', 'no-store')
         .send(data);

    } catch (error: any) {
      res.status(500).json({ 
        error: 'Proxy Connection Failed', 
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
