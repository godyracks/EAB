const mongoose = require('mongoose');
const redisClient = require('../redis');

// Cache the MongoDB connection state
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    // Log the MongoDB URI for debugging (mask the password)
    const uri = process.env.MONGO_URI;
    const maskedUri = uri.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED]:[REDACTED]@');
    console.log('Connecting to MongoDB with URI:', maskedUri);

    // Connect to MongoDB with timeout settings
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if no server is selected
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    isConnected = true;
    console.log('MongoDB connected successfully');

    // Ensure Redis is connected (non-critical)
    try {
      await redisClient.ping();
      console.log('Redis ping successful');
    } catch (err) {
      console.error('Redis ping failed, continuing without Redis:', err);
    }
  } catch (error) {
    console.error('Database connection error:', error);
    isConnected = false;
    throw error; // Throw the error so the API route can handle it gracefully
  }
};

module.exports = connectDB;