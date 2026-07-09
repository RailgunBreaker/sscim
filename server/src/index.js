import express from 'express';
import cors from 'cors';
import './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`SSCIM vault API listening on http://localhost:${PORT}`);
});
