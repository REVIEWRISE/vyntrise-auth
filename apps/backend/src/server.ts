import dotenv from 'dotenv';
import app from './app';
import { emailProvider } from './services/email.service';
import { assertRequiredEnv } from './config/env';
import { reportEmailConfig } from './config/email';
import { reportSigningKeys } from './services/signing-key.service';

dotenv.config();
assertRequiredEnv();
reportEmailConfig();

const PORT = process.env.PORT || 3021;

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Email transport: ${emailProvider.name}`);

  // After listen, so a slow database cannot delay the port opening and fail the health check.
  void reportSigningKeys();
});
