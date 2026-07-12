// database.js
// Handles MongoDB connection setup using Mongoose.

const mongoose = require('mongoose');

// Connection string: falls back to a local database if no env var is set.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blog-platform';

/**
 * Connects to MongoDB.
 * Logs a clear success/error message and exits the process on failure,
 * since the app cannot function without a database connection.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Log helpful runtime connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

module.exports = connectDB;