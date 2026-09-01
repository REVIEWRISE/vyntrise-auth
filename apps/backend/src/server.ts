import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import inviteRoutes from './routes/invite.routes';
import adminRoutes from './routes/admin.routes';
import passwordResetRoutes from './routes/password-reset.routes';
import accountRoutes from './routes/account.routes';
import wellKnownRoutes from './routes/well-known.routes';
import { emailProvider } from './services/email.service';
import { authenticateJWT } from './middlewares/auth.middleware';
import { assertRequiredEnv } from './config/env';
import { reportEmailConfig } from './config/email';
import { reportSigningKeys } from './services/signing-key.service';

dotenv.config();
assertRequiredEnv();
reportEmailConfig();

const app = express();
const PORT = process.env.PORT || 3021;

// Behind nginx, req.ip is the proxy's address unless Express is told to read
// X-Forwarded-For — without this every caller shares one rate-limit bucket.
app.set('trust proxy', 1);

// Middlewares
// CORS configuration for cross-origin requests from external platforms
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3001'];

// A wildcard origin cannot be combined with credentials: it would let any site on the internet
// make authenticated requests with the user's cookies. Refuse to start rather than silently
// running wide open.
if (allowedOrigins.includes('*')) {
  console.error(
    'ALLOWED_ORIGINS contains "*", which cannot be used with credentialed CORS. ' +
    'List each permitted origin explicitly.'
  );
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Platform-Id'],
  exposedHeaders: ['Set-Cookie'],
}));
app.use(express.json());
app.use(cookieParser());

// Health checks
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vyntrise-auth-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vyntrise-auth-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Discovery and public keys. Mounted at the standard path and mirrored under /api, because
// the production reverse proxy only forwards /api to this service — the /api form is what
// actually reaches us today, while the canonical one is rewritten to it by the frontend.
app.use('/.well-known', wellKnownRoutes);
app.use('/api/.well-known', wellKnownRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', authenticateJWT, accountRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Email transport: ${emailProvider.name}`);

  // After listen, so a slow database cannot delay the port opening and fail the health check.
  void reportSigningKeys();
});
