import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  // En AWS RDS la conexión va cifrada (SSL). En local se deja en false.
  dbSsl: process.env.DB_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
};
