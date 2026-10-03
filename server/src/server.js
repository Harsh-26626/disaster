import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';

import mapRouter from './routes/map.js';
import reportRouter from './routes/report.js';
import alertsRouter from './routes/alerts.js';
import chatRouter from './routes/chat.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'disaster-intel-api', timestamp: new Date() });
});

app.use('/api/map', mapRouter);
app.use('/api/report', reportRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

// Connect to database and start server
async function startServer(port = PORT) {
  try {
    await connectDB();
    return app.listen(port, () => {
      console.log(`[Server] Running on port ${port} (http://localhost:${port})`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Start automatically when run directly
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1].endsWith('server.js')
);

if (isMain) {
  startServer();
}

export { app, startServer };
export default app;
