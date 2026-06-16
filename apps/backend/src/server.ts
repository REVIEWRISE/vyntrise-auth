import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import inviteRoutes from './routes/invite.routes';
import adminRoutes from './routes/admin.routes';
import passwordResetRoutes from './routes/password-reset.routes';
import accountRoutes from './routes/account.routes';
import { emailService } from './services/email.service';
import { authenticateJWT } from './middlewares/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3021;

// Middlewares
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

import { getPlatforms, createPlatform } from './controllers/admin.controller';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', authenticateJWT, accountRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'vyntrise-auth' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Email provider: ${process.env.EMAIL_PROVIDER ?? 'console'} (${emailService.constructor.name})`);
});
