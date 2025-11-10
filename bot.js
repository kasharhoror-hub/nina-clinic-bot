/*
  bot.js - Nina Medium Clinic (ES Module + Telegraf)
  *** FINAL VERCEL FIX: Using @telegraf/session for Serverless Webhook ***
*/

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// CORRECT IMPORTS FOR SERVERLESS SESSION
import { Telegraf, Markup } from 'telegraf';
import { session } from '@telegraf/session'; 

// Configure dotenv
dotenv.config();

// ES Module replacements for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
// Parse ADMIN_ID as a number
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID, 10) : null;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN missing. Deployment will likely fail.');
}

if (!ADMIN_ID) {
  console.warn('⚠️ ADMIN_ID missing — admin will not receive booking messages.');
} else {
  console.log(`ℹ️ Admin ID is set to: ${ADMIN_ID}`);
}

// --- INITIALIZATION & SESSION SETUP ---
const bot = new Telegraf(BOT_TOKEN);

// Apply Telegraf's official session middleware for serverless functions.
// This is the correct way to handle state in this environment.
bot.use(session({
    // Initializer to ensure ctx.session always starts with an empty object
    defaultSession: () => ({}) 
}));

// Local welcome image path (must exist in the same folder)
const LOCAL_WELCOME_IMAGE = path.join(__dirname, 'nina.jpg');


/**
 * Escapes Telegram MarkdownV2 special characters.
 */
function escapeMarkdownV2(text) {
  if (!text) return '';
  const chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  return text.replace(new RegExp(`[${chars.map(c => '\\' + c).join('')}]`, 'g'), '\\$&');
}

// Welcome text
function welcomeText() {
  return `👋 እንኳን ወደ *Nina Medium Clinic22* በደህNA መጡ!
Welcome to *Nina Clinic* 💖

🩺 እኛ የምናስገባቸው አገልግሎቶች | Our Services:
• የጤና ምርመራ እና ምክር / Check-up & Advice
• የህፃናት እና አባላት እንክብካቤ / Pediatric & Family Care
• የሴቶች ጤና / Women's Health
• የህመም መቆጣጠሪያ / Pain Management
• የምርመራ ክፍል / Lab Services

📍 ቦታ / Location: [Click here to see map](https://maps.app.goo.gl/sCkAb8ghcHpZmQ6G8)

📅 ለማውደድ እባክዎ ቀጥሉ።
To book an an appointment, press the button below.`;
}

// Format admin summary (Markdown)
function formatAdminSummary(session, from) {
  // Access properties from ctx.session 
  const fullName = escapeMarkdownV2(session.fullName || 'N/A');
  const contact = escapeMarkdownV2(session.contact || 'N/A');
  const service = escapeMarkdownV2(session.service || 'N/A');
  const datetime = escapeMarkdownV2(session.datetime || 'N/A');
  const message = escapeMarkdownV2(session.message || 'N/A');
    
  const firstName = escapeMarkdownV2(from.first_name || '');
  const lastName = escapeMarkdownV2(from.last_name || '');
  const username = escapeMarkdownV2(from.username || 'N/A');

  return `📩 *New Booking Received*
👤 *Full Name:* ${fullName}
📞 *Contact:* ${contact}
🩺 *Service:* ${service}
📅 *Preferred Date/Time:* ${datetime}
💬 *Message:* ${message}

• From Telegram: ${firstName} ${lastName} (@${username})`;
}

// /start - show welcome message and buttons
bot.start(async (ctx) => {
  // Initialize session data
  ctx.session = {};

  // Send local photo if available
  try {
    if (fs.existsSync(LOCAL_WELCOME_IMAGE)) {
      await ctx.replyWithPhoto({ source: fs.createReadStream(LOCAL_WELCOME_IMAGE) }, {
        caption: welcomeText(),
        parse_mode: 'Markdown'
      });
    } else {
      console.warn('⚠️ nina.jpg not found. Sending text only.');
      await ctx.reply(welcomeText(), { parse_mode: 'Markdown' });
    }
  } catch (err) {
    // Fallback if sending photo fails
    console.error('Error sending welcome photo:', err.message);
    await ctx.reply(welcomeText(), { parse_mode: 'Markdown' });
  }

  // Show Start / Cancel buttons
  await ctx.reply(
    'እባክዎ አንዱን ይምረጡ / Please choose an option:',
    Markup.inlineKeyboard([
      [Markup.button.callback('ለመጀመር / Start', 'start_booking')],
      [Markup.button.callback('ተወው / Cancel', 'cancel_booking')]
    ])
  );
});

// Cancel handler
bot.action('cancel_booking', async (ctx) => {
  // Clear the session entirely
  ctx.session = {}; 
  try {
    await ctx.editMessageText('❌ ሂደቱ ተሰርዟል። Booking cancelled.');
  } catch (e) {
    console.warn('Edit message failed (cancel):', e.message);
  }
  await ctx.reply('Booking cancelled. Send /start to begin again.');
});

// Start booking - ask for Full Name
bot.action('start_booking', async (ctx) => {
  // Initialize session data for the wizard start
  ctx.session = { step: 'name' };
  try {
    await ctx.editMessageText('👤 ሙሉ ስምዎን ያስገቡ።\nPlease enter your Full Name:');
  } catch (e) {
    console.warn('Edit message failed (start_booking):', e.message);
    await ctx.reply('👤 ሙሉ ስምዎን ያስገቡ።\nPlease enter your Full Name:');
  }
});

// --- Service Button Handlers ---

// Helper function to handle ALL service selections
async function handleServiceSelection(ctx, serviceName) {
  // Access session via ctx.session
  const s = ctx.session;
  
  // Check if we are in the right step and session exists
  if (!s || s.step !== 'service') {
    return ctx.reply('Session expired or in wrong step. Send /start to begin.');
  }
    
  s.service = serviceName;
  s.step = 'datetime';
  const year = new Date().getFullYear();

  try {
    await ctx.editMessageText(`📅 እባክዎ የቀንና ሰዓት ያስገቡ / Enter preferred Date & Time (e.g., ${year}-10-27 14:00):`);
  } catch (e) {
    console.warn('Edit message failed (service selection):', e.message);
    await ctx.reply(`📅 እባክዎ የቀንና ሰዓት ያስገቡ / Enter preferred Date & Time (e.g., ${year}-10-27 14:00):`);
  }
}

// Create actions for all 5 services
bot.action('service_checkup', (ctx) => handleServiceSelection(ctx, 'የጤና ምርመራ እና ምክር / Check-up & Advice'));
bot.action('service_pediatric', (ctx) => handleServiceSelection(ctx, 'የህፃናት እና አባላት እንክብካቤ / Pediatric & Family Care'));
bot.action('service_women', (ctx) => handleServiceSelection(ctx, 'የሴቶች ጤና / Women\'s Health'));
bot.action('service_pain', (ctx) => handleServiceSelection(ctx, 'የህመም መቆጣጠሪያ / Pain Management'));
bot.action('service_lab', (ctx) => handleServiceSelection(ctx, 'የምርመራ ክፍል / Lab Services'));


// Text handler for wizard steps
bot.on('text', async (ctx) => {
  // Access session via ctx.session
  const session = ctx.session;
  
  const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';

  if (!session || !session.step) {
    return ctx.reply('Send /start to begin the booking process. / እባክዎ /start ይጫኑ።');
  }

  if (text.startsWith('/')) {
    return;
  }

  try {
    switch (session.step) {
      case 'name':
        session.fullName = text;
        session.step = 'contact';
        await ctx.reply('📞 እባክዎ ስልክ ቁጥርዎን ወይም ኢሜይልዎን ያስገቡ / Please enter your Contact (phone or email):');
        break;

      case 'contact':
        session.contact = text;
        session.step = 'service';
          
        await ctx.reply(
          '🩺 የሚፈልጉትን አገልግሎት ይምረጡ / Please choose the service:',
          Markup.inlineKeyboard([
            [Markup.button.callback('ምርመራ እና ምክር', 'service_checkup')],
            [Markup.button.callback('የህፃናት እንክብካቤ', 'service_pediatric')],
            [Markup.button.callback('የሴቶች ጤና', 'service_women')],
            [Markup.button.callback('የህመም መቆጣጠሪያ', 'service_pain')],
            [Markup.button.callback('የምርመራ ክፍል', 'service_lab')],
            [Markup.button.callback('ተወው / Cancel', 'cancel_booking')]
          ], { columns: 2 })
        );
        break;

      case 'service':
        await ctx.reply('Please press one of the service buttons above. / እባክዎ ከላይ ያሉትን የአገልግሎት ቁልፎች ይጫኑ።');
        break;

      case 'datetime':
        session.datetime = text;
        session.step = 'message';
        await ctx.reply('💬 ስለራስዎ ከፈለጉ መልእክት ያስገቡ / Any additional message? (type "none" if none):');
        break;

      case 'message':
        session.message = text;
        session.step = 'done';

        const userSummary = `📩 እናመሰግናለን — Here is your booking summary:
👤 Full Name: ${session.fullName}
📞 Contact: ${session.contact}
🩺 Service: ${session.service}
📅 Preferred Date/Time: ${session.datetime}
💬 Message: ${session.message}

We will contact you soon.`;
          
        const adminSummary = formatAdminSummary(session, ctx.from);

        await ctx.reply(userSummary, Markup.inlineKeyboard([
          [Markup.button.callback('🔁 እንደገና ጀምር / Start Again', 'start_booking')]
        ]));

        if (ADMIN_ID) {
          try {
            await bot.telegram.sendMessage(ADMIN_ID, adminSummary, { parse_mode: 'Markdown' });
            console.log(`✅ Sent booking to admin ${ADMIN_ID}`);
          } catch (err) {
            console.error(`❌ FAILED to send booking to admin ID: ${ADMIN_ID}`);
            console.error('Full error:', err.message);
          }
        } else {
          console.warn('No ADMIN_ID set — booking was NOT sent to admin.');
        }

        // Clear session
        ctx.session = {}; 
        break;

      default:
        await ctx.reply('Unexpected step. Send /start to begin again. / እባክዎ /start ይጫኑ።');
        // Clear session on error
        ctx.session = {}; 
    }
  } catch (err) {
    console.error('Handler error:', err.stack || err);
    // Clear session on major error
    ctx.session = {}; 
    await ctx.reply('⚠️ An error occurred. Please send /start and try again. / እባክዎ /start ይጫኑ።');
  }
});

// Global error logging
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}`, err);
});

// --- VERCEL WEBHOOK INTEGRATION ---

/**
 * The main handler function for Vercel.
 */
export default async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
      // Send an immediate 200 OK response to Telegram
      res.statusCode = 200;
      res.end('ok');
    } else if (req.method === 'GET') {
      // Handle simple GET requests (e.g., visiting the URL in a browser)
      res.statusCode = 200;
      res.end('Nina Clinic Bot is running via Vercel Webhook.');
    } else {
      res.statusCode = 405; // Method Not Allowed
      res.end('Method not allowed.');
    }
  } catch (err) {
    console.error('Vercel Webhook Handler Error:', err.message);
    res.statusCode = 500;
    res.end('Internal Server Error.');
  }
};
// --- END VERCEL WEBHOOK INTEGRATION ---
