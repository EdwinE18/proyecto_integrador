import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
};
