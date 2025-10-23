require('dotenv').config();
const https = require('https');
const token = process.env.BOT_TOKEN;
if (!token) { console.error('NO_TOKEN'); process.exit(1); }
const url = `https://api.telegram.org/bot${token}/getMe`;
https.get(url, (res) => {
  console.log('STATUS', res.statusCode);
  res.on('data', () => {}); // consume
  res.on('end', () => console.log('END'));
}).on('error', (e) => {
  console.error('ERROR', e && e.code, e && e.message);
  if (e && e.stack) console.error(e.stack.split('\n').slice(0,6).join('\n'));
});
