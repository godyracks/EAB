const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const reviewRoutes = require('./routes/review.routes');
const techRoutes = require('./routes/tech.routes');
const searchRoutes = require('./routes/search.routes');
const cors = require('cors');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'RESEND_API_KEY', 'FROM_EMAIL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload directory at ${UPLOAD_DIR}`);
}

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173', // Vite frontend (development)
  'https://edu-ability.vercel.app', // Production frontend on Vercel
  'https://eduability.onrender.com', // Render backend (for testing)
  'https://edu-ability.com', // Production frontend on Lightsail
  'http://edu-ability.com',
  'edu-ability.com',
];

// Log environment variables for debugging (mask sensitive data)
console.log('Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGO_URI:', process.env.MONGO_URI.replace(/:\/\/[^:]+:[^@]+@/, '://[REDACTED]:[REDACTED]@'));
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'Not set');
console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
console.log('PORT:', PORT);
console.log('UPLOAD_DIR:', UPLOAD_DIR);

const app = express();

// CORS Middleware Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log('Blocked CORS request from:', origin);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Middleware
app.use(morgan('dev'));
app.use(bodyParser.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(UPLOAD_DIR));

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB, exiting...', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/technologies', techRoutes);
app.use('/api/search', searchRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS policy: Origin not allowed' });
  }
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the app for Vercel (if needed in the future)
module.exports = app;