const { createClient } = require('redis');

// Use environment variable for Redis URL, fallback to localhost
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log('Attempting to connect to Redis with URL:', redisUrl);

// Create the Redis client
const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      // Retry every 50ms, max 2 seconds
      const delay = Math.min(retries * 50, 2000);
      console.log(`Retrying connection to Redis in ${delay}ms...`);
      return delay;
    },
    connectTimeout: 10000, // Timeout for initial connection (10 seconds)
  },
});

// Connection events
redisClient.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redisClient.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redisClient.on('end', () => {
  console.log('Redis connection closed');
});

// Connect the client
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing Redis connection...');
  await redisClient.quit();
  process.exit(0);
});

module.exports = redisClient;