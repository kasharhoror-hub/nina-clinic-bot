/*
 * bot.js - Nina Medium Clinic (ES Module + Telegraf)
 *
 * - Uses local image nina.jpg for welcome
 * - Full Amharic + English texts with map link
 * - Booking wizard with 5 services:
 * 1. Full Name
 * 2. Contact
 * 3. Service (5 buttons)
 * 4. Date/Time
 * 5. Message
 * - Sends summary to user AND to admin (from ADMIN_ID in .env)
 * - Admin notification warning removed from user view.
 *
 * IMPORTANT: bot.launch() is removed and the bot instance is exported for Vercel Webhook compatibility.
*/

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Telegraf, Markup } from 'telegraf';

// Configure dotenv
dotenv.config();

// ES Module replacements for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
// Parse ADMIN_ID as a number
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID, 10) : null;

if (!BOT_TOKEN) {
  // We keep the console.error, but Vercel requires the token be set as an Environment Variable
  console.error('❌ BOT_TOKEN missing in .env. Please get it from BotFather.');
  // Removed process.exit(1) as Vercel functions cannot gracefully exit this way
}


if (!ADMIN_ID) {
  console.warn('⚠️ ADMIN_ID missing in .env — admin will not receive booking messages.');
  console.warn('⚠️ To fix this, get your User ID from @userinfobot on Telegram and add it to .env');
} else {
  // Log the admin ID on startup to confirm it's loaded
  console.log(`ℹ️ Admin ID is set to: ${ADMIN_ID}`);
  console.log('ℹ️ Make sure this admin has started a chat with the bot.');
}


const bot = new Telegraf(BOT_TOKEN);

// In-memory sessions map: chatId -> session object
// This stores the user's progress
const sessions = new Map();

// Local welcome image path (must exist in the same folder)
const LOCAL_WELCOME_IMAGE = path.join(__dirname, 'nina.jpg');

/**
 * Escapes Telegram MarkdownV2 special characters.
 * This prevents user input from breaking the admin message format.
 * @param {string} text The text to escape.
 * @returns {string} The escaped text.
*/
function escapeMarkdownV2(text) {
  if (!text) return '';
  // List of special characters for MarkdownV2
  const chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  // Use regex to add a '\' before each special character
  return text.replace(new RegExp(`[${chars.map(c => '\\' + c).join('')}]`, 'g'), '\\$&');
}

// Welcome text (Merged from both versions)
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
  // Use escapeMarkdownV2 on all user-supplied content
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

// /start - show local image + caption + Start/Cancel buttons
bot.start(async (ctx) => {
  // Clear any existing session for this user
  sessions.delete(ctx.chat.id);

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
  sessions.delete(ctx.chat.id);
  try {
    await ctx.editMessageText('❌ ሂደቱ ተሰርዟል። Booking cancelled.');
  } catch (e) {
    console.warn('Edit message failed (cancel):', e.message);
  }
  await ctx.reply('Booking cancelled. Send /start to begin again.');
});

// Start booking - ask for Full Name
bot.action('start_booking', async (ctx) => {
  sessions.set(ctx.chat.id, { step: 'name' });
  try {
    await ctx.editMessageText('👤 ሙሉ ስምዎን ያስገቡ።Please enter your Full Name:');
  } catch (e) {
    console.warn('Edit message failed (start_booking):', e.message);
    // Fallback if edit fails
    await ctx.reply('👤 ሙሉ ስምዎን ያስገቡ።Please enter your Full Name:');
  }
});

// --- Service Button Handlers ---

// Helper function to handle ALL service selections
async function handleServiceSelection(ctx, serviceName) {
  const s = sessions.get(ctx.chat.id);
  if (!s || s.step !== 'service') {
    return ctx.reply('Session expired or in wrong step. Send /start to begin.');
  }
  
  s.service = serviceName;
  s.step = 'datetime';
  const year = new Date().getFullYear(); // Use current year as example

  try {
    await ctx.editMessageText(`📅 እባክዎ የቀንና ሰዓት ያስገቡ / Enter preferred Date & Time (e.g., ${year}-10-27 14:00):`);
  } catch (e) {
    console.warn('Edit message failed (service selection):', e.message);
    // Fallback if edit fails
    await ctx.reply(`📅 እባкዎ የቀንና ሰዓት ያስገቡ / Enter preferred Date & Time (e.g., ${year}-10-27 14:00):`);
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
  const chatId = ctx.chat.id;
  // Ensure text exists and trim whitespace
  const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
  const session = sessions.get(chatId);

  if (!session) {
    return ctx.reply('Send /start to begin the booking process. / እባкዎ /start ይጫኑ።');
  }

  // Ignore commands
  if (text.startsWith('/')) {
    return;
  }

  try {
    switch (session.step) {
      case 'name':
        session.fullName = text;
        session.step = 'contact';
        await ctx.reply('📞 እባкዎ ስልክ ቁጥርዎን ወይም ኢሜይልዎን ያስገቡ / Please enter your Contact (phone or email):');
        break;

      case 'contact':
        session.contact = text;
        session.step = 'service'; // Now waiting for a button press
        
        // Show the 5 new service buttons
        await ctx.reply(
          '🩺 የሚፈልጉትን አገልግሎት ይምረጡ / Please choose the service:',
          Markup.inlineKeyboard([
            [Markup.button.callback('ምርመራ እና ምክር', 'service_checkup')],
            [Markup.button.callback('የህፃናት እንክብካቤ', 'service_pediatric')],
            [Markup.button.callback('የሴቶች ጤና', 'service_women')],
            [Markup.button.callback('የህመም መቆጣጠሪያ', 'service_pain')],
            [Markup.button.callback('የምርመራ ክፍል', 'service_lab')],
            [Markup.button.callback('ተወው / Cancel', 'cancel_booking')]
          ], { columns: 2 }) // Arrange in 2 columns
        );
        break;

      case 'service':
        // This case is now handled by the 'bot.action' handlers above.
        // We add this reply just in case they type text instead of pressing a button.
        await ctx.reply('Please press one of the service buttons above. / እባкዎ ከላይ ያሉትን የአገልግሎት ቁልፎች ይጫኑ።');
        break;

      case 'datetime':
        session.datetime = text;
        session.step = 'message';
        await ctx.reply('💬 ስለራስዎ ከፈለጉ መልእክት ያስገቡ / Any additional message? (type "none" if none):');
        break;

      case 'message':
        session.message = text;
        session.step = 'done'; // Mark session as complete

        // Compose user summary
        const userSummary = `📩 እናመሰግናለን — Here is your booking summary:
👤 Full Name: ${session.fullName}
📞 Contact: ${session.contact}
🩺 Service: ${session.service}
📅 Preferred Date/Time: ${session.datetime}
💬 Message: ${session.message}

We will contact you soon.`;
        
        // Compose admin summary (Markdown)
        const adminSummary = formatAdminSummary(session, ctx.from);

        // Send user summary + Start Again button
        await ctx.reply(userSummary, Markup.inlineKeyboard([
          [Markup.button.callback('🔁 እንደገና ጀምር / Start Again', 'start_booking')]
        ]));

        // Send to admin
        if (ADMIN_ID) {
          try {
            await bot.telegram.sendMessage(ADMIN_ID, adminSummary, { parse_mode: 'Markdown' });
            console.log(`✅ Sent booking to admin ${ADMIN_ID}`);
          } catch (err) {
            // Logging for terminal (You see this)
            console.error(`❌ FAILED to send booking to admin ID: ${ADMIN_ID}`);
            console.error('Full error:', err.message);
            // WARNING REMOVED HERE: The user only receives the success message above.
          }
        } else {
          console.warn('No ADMIN_ID set — booking was NOT sent to admin.');
        }

        // Clear session (Fixed typo: using chatId instead of chId)
        sessions.delete(chatId);
        break;

      default:
        await ctx.reply('Unexpected step. Send /start to begin again. / እባкዎ /start ይጫኑ።');
        sessions.delete(chatId);
    }
  } catch (err) {
    console.error('Handler error:', err.stack || err);
    sessions.delete(chatId);
    await ctx.reply('⚠️ An error occurred. Please send /start and try again. / እባкዎ /start ይጫኑ።');
  }
});

// Global error logging
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}`, err);
});

// --- Vercel Compatibility Change: Remove Launch, Export Bot ---
// Removed:
// bot.launch().then(...)
// process.once('SIGINT', ...)
// process.once('SIGTERM', ...)

// NEW: Export the bot instance for the webhook handler to use
export { bot };
