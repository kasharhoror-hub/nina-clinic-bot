// ===============================
// Nina Medium Clinic Bot
// With Amharic + English Buttons
// ===============================

import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

// ✅ Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Store user sessions in memory
const userSessions = new Map();

// 🟢 Start or Cancel menu
bot.start((ctx) => {
  userSessions.delete(ctx.chat.id);
  ctx.reply(
    "👋 እንኳን ወደ ኒና መካከለኛ ክሊኒክ በደህና መጡ።\nWelcome to Nina Medium Clinic!\n\nPlease choose an option below:",
    Markup.inlineKeyboard([
      [Markup.button.callback("ለመጀመር /Start", "start_booking")],
      [Markup.button.callback("ተወው /Cancel", "cancel_booking")],
    ])
  );
});

// 🟡 Cancel booking
bot.action("cancel_booking", (ctx) => {
  userSessions.delete(ctx.chat.id);
  ctx.editMessageText(
    "❌ ሂደቱን ተወውን።\nYou have cancelled the booking process."
  );
});

// 🟢 Start booking
bot.action("start_booking", (ctx) => {
  userSessions.set(ctx.chat.id, { step: "name" });
  ctx.editMessageText("👤 ሙሉ ስምዎን ያስገቡ።\nPlease enter your Full Name:");
});

// 🟢 Handle text inputs
bot.on("text", async (ctx) => {
  const session = userSessions.get(ctx.chat.id);
  if (!session) return ctx.reply("👉 Press /start to begin a new booking.");

  const text = ctx.message.text.trim();

  switch (session.step) {
    // ====== STEP 1: Full Name ======
    case "name":
      session.fullName = text;
      session.step = "contact";
      return ctx.reply("📞 ስልክ ቁጥርዎን ያስገቡ።\nPlease enter your Contact (phone/email):");

    // ====== STEP 2: Contact ======
    case "contact":
      session.contact = text;
      session.step = "service";
      return ctx.reply(
        "🩺 የሚፈልጉትን አገልግሎት ይምረጡ።\nPlease choose the service you want:",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("💉 የህክምና ምርመራ / Check-up", "service_checkup"),
          ],
          [
            Markup.button.callback("❤️ አጠቃላይ ምርመራ / General Diagnosis", "service_diagnosis"),
          ],
        ])
      );

    // ====== STEP 4: Date & Time ======
    case "datetime":
      session.datetime = text;
      session.step = "message";
      return ctx.reply(
        "💬 ስለራስዎ መልእክት ይፃፉ።\nPlease enter any additional message or inquiry:"
      );

    // ====== STEP 5: Final Message ======
    case "message":
      session.message = text;
      userSessions.delete(ctx.chat.id);

      // ✅ Send confirmation
      const summary = `
📩 *New Booking*
👤 Full Name: ${session.fullName}
📞 Contact: ${session.contact}
🩺 Service: ${session.service}
📅 Date/Time: ${session.datetime}
💬 Message: ${session.message}

እናመሰግናለን፣ ቦታ ማስያዣውን በተሳካ ሁኔታ አጠናቅቀዋል።
We thank you! Your booking was successfully completed. We will reach you soon.
`;

      await ctx.replyWithMarkdown(summary);
      break;

    default:
      ctx.reply("⚠️ Please follow the steps or press /start to begin again.");
  }
});

// 🟢 Handle Service selection
bot.action("service_checkup", (ctx) => {
  const session = userSessions.get(ctx.chat.id);
  if (!session) return ctx.reply("Please start again with /start.");
  session.service = "💉 የህክምና ምርመራ / Check-up";
  session.step = "datetime";
  ctx.editMessageText("📅 የመረጡት ቀን እና ሰዓት ያስገቡ።\nEnter Preferred Date & Time (e.g., 2025-10-25 14:00):");
});

bot.action("service_diagnosis", (ctx) => {
  const session = userSessions.get(ctx.chat.id);
  if (!session) return ctx.reply("Please start again with /start.");
  session.service = "❤️ አጠቃላይ ምርመራ / General Diagnosis";
  session.step = "datetime";
  ctx.editMessageText("📅 የመረጡት ቀን እና ሰዓት ያስገቡ።\nEnter Preferred Date & Time (e.g., 2025-10-25 14:00):");
});

// 🟢 Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("⚠️ An unexpected error occurred. Please try again.");
});

// ✅ Launch bot
bot.launch();
console.log("🤖 Bot is running successfully...");

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
