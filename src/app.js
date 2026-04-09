require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

// [CRITICAL] JWT Secret 강도 검증
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

const app = express();

// Middleware
app.use(helmet());

// [HIGH] CORS — 허용 도메인 제한
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  credentials: true,
}));

// [HIGH] Body 크기 제한 — 대용량 payload DoS 방지
app.use(express.json({ limit: '10kb' }));

// [LOW] XSS 방지 — 모든 요청 body sanitize
app.use(require('./middleware/sanitize'));

// [HIGH] 전역 Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});
app.use('/api', globalLimiter);

// [HIGH] 인증 엔드포인트 강화 Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15분에 10회
  message: { error: '인증 요청이 너무 많습니다. 15분 후 다시 시도하세요.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/experts', require('./routes/experts'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/proposals', require('./routes/proposals'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/messages', require('./routes/messages'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// Error handler
app.use(errorHandler);

// Start server (skip in test)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;

  // Production: auto-migrate on startup
  const db = require('./config/database');
  const knexConfig = require('./config/knexfile');
  const env = process.env.NODE_ENV || 'development';

  db.migrate.latest(knexConfig[env]).then(() => {
    console.log('DB migrations up to date');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = app;
