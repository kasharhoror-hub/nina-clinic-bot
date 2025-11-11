import { bot } from '../bot.js'; // Adjust path if your structure is different

// Telegraf is smart enough to handle the webhook request from Vercel/Node.js
// The '/api' path is defined in vercel.json
const webhookHandler = bot.webhookCallback('/api');

/**
 * Main serverless function handler.
 * @param {import('http').IncomingMessage} req - The Node.js request object (from Telegram).
 * @param {import('http').ServerResponse} res - The Node.js response object.
 */
export default async (req, res) => {
  try {
    // Check if the BOT_TOKEN is missing (important for Vercel)
    if (!process.env.BOT_TOKEN) {
      console.error('FATAL: BOT_TOKEN is not set in Vercel environment variables.');
      res.status(500).send('Configuration Error: BOT_TOKEN missing.');
      return;
    }
    
    // Process the Telegram update
    await webhookHandler(req, res);
    
  } catch (err) {
    console.error('Webhook processing error:', err.stack || err);
    // Respond with a 200 OK to Telegram even on unhandled error, to prevent retries.
    if (!res.headersSent) {
      res.status(200).send('OK (Error Handled Internally)');
    }
  }
};
