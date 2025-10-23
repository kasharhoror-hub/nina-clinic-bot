require('dotenv').config();
const fetch = require('node-fetch');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('No BOT_TOKEN found!');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${token}/getMe`;

console.log('Using URL:', url);

fetch(url)
  .then(res => res.json())
  .then(data => console.log('Bot info:', data))
  .catch(err => console.error('Fetch error:', err));
