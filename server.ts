import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const importPath = path.join(__dirname, 'src', 'data', 'imported_stock.json');

  // Admin endpoint to import stock list into Mary's joypub
  app.post('/api/admin/import-stock', async (req, res) => {
    try {
      const { businessName = "Mary's joypub", items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required' });
      }

      console.log(`Importing ${items.length} items into business: ${businessName}`);

      const results = items.map((item: any, idx: number) => {
        const name = (item.name || '').trim();
        const opening = parseQty(item.opening);
        const added = parseQty(item.added || 0);
        const closing = parseQty(item.closing);
        return {
          id: `prod-import-${Date.now()}-${idx}`,
          businessName,
          name,
          opening,
          added,
          closing,
          sellingPrice: 0,
        };
      });

      if (!fs.existsSync(path.dirname(importPath))) {
        fs.mkdirSync(path.dirname(importPath), { recursive: true });
      }
      fs.writeFileSync(importPath, JSON.stringify(results, null, 2));

      return res.json({
        success: true,
        message: `Successfully processed ${results.length} items for ${businessName}`,
        importedCount: results.length,
        items: results,
      });
    } catch (err: any) {
      console.error('Import stock error:', err);
      return res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  // Endpoint for client app to fetch imported stock for Mary's joypub
  app.get('/api/admin/imported-stock', (req, res) => {
    try {
      if (fs.existsSync(importPath)) {
        const data = JSON.parse(fs.readFileSync(importPath, 'utf8'));
        return res.json({ success: true, items: data });
      }
      return res.json({ success: true, items: [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  function parseQty(val: any): number {
    if (val === undefined || val === null || val === '—' || val === '-' || val === '') return 0;
    const str = String(val).trim();
    if (str === '—' || str === '-') return 0;
    if (str.includes('1/2')) {
      const parts = str.split(' ');
      if (parts.length === 2) {
        return parseFloat(parts[0]) + 0.5;
      }
      return 0.5;
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // Vite middleware for development (HMR disabled in container environment)
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
