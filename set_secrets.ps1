gh secret set DATABASE_URL --body "postgresql://postgres:password@localhost:55432/vyntrise_auth?schema=public" --repo REVIEWRISE/vyntrise-auth
gh secret set JWT_SECRET --body "supersecretjwt12345" --repo REVIEWRISE/vyntrise-auth
gh secret set JWT_REFRESH_SECRET --body "supersecretrefresh12345" --repo REVIEWRISE/vyntrise-auth
gh secret set NODE_ENV --body "production" --repo REVIEWRISE/vyntrise-auth
gh secret set PORT --body "3021" --repo REVIEWRISE/vyntrise-auth
gh secret set NEXT_PUBLIC_API_URL --body "https://auth.vyntrise.com/api" --repo REVIEWRISE/vyntrise-auth
gh secret set ALLOWED_ORIGINS --body "https://auth.vyntrise.com" --repo REVIEWRISE/vyntrise-auth
gh secret set POSTGRES_USER --body "postgres" --repo REVIEWRISE/vyntrise-auth
gh secret set POSTGRES_PASSWORD --body "REPLACE_STRONG_PASSWORD" --repo REVIEWRISE/vyntrise-auth
gh secret set DEPLOY_HOST --body "YOUR_SERVER_IP" --repo REVIEWRISE/vyntrise-auth
gh secret set DEPLOY_USER --body "ubuntu" --repo REVIEWRISE/vyntrise-auth
gh secret set DEPLOY_SSH_KEY --body "REPLACE_WITH_PRIVATE_KEY" --repo REVIEWRISE/vyntrise-auth
gh secret set DEPLOY_PORT --body "22" --repo REVIEWRISE/vyntrise-auth
Write-Host "All secrets uploaded to REVIEWRISE!"
