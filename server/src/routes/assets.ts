import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

router.get('/assets', (_req, res) => {
  const assets = db.prepare('SELECT * FROM assets ORDER BY symbol').all();
  res.json({ data: assets });
});

router.get('/assets/:id/prices', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const prices = db
    .prepare(
      'SELECT * FROM prices WHERE asset_id = ? ORDER BY recorded_at DESC LIMIT ?'
    )
    .all(id, limit);
  res.json({ data: prices });
});

router.get('/signals', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
  const signals = db
    .prepare(
      `SELECT s.*, a.symbol, a.name
       FROM signals s
       LEFT JOIN assets a ON s.asset_id = a.id
       ORDER BY s.created_at DESC
       LIMIT ?`
    )
    .all(limit);
  res.json({ data: signals });
});

export default router;
