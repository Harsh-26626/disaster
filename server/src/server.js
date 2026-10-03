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
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} (http://localhost:${PORT})`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

app.listen(3000, () => {
  console.log('[Server] Running on port 3000 (http://localhost:3000)');
})

// startServer();

export default app;
