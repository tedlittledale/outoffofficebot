import { Telegraf } from 'telegraf';
import { createServer } from 'node:http';
import { config } from './config.js';
import { registerHandlers } from './bot/handlers.js';
import { startMorningCron, stopMorningCron } from './scheduler/morning.js';

const bot = new Telegraf(config.telegram.botToken);

registerHandlers(bot);
startMorningCron(bot);

// Health check HTTP server
const server = createServer((_req, res) => {
  if (_req.url === '/health' && _req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(config.port, () => {
  console.log(`Health check server listening on port ${config.port}`);
});

// Start bot (long polling). bot.launch() resolves only on shutdown.
console.log('Bot polling started');
bot.launch().then(() => {
  console.log('Bot polling stopped');
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  stopMorningCron();
  bot.stop(signal);
  server.close();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
