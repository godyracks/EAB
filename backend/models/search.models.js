const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const searchSchema = new mongoose.Schema({
  searchId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true,
  },
  query: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: String,
    ref: 'User',
    default: null,
  },
  filters: {
    type: Object,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('Search', searchSchema);