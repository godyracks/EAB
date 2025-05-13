const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true,
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  avatar: { type: String },
  socialLinks: {
    twitter: { type: String },
    linkedin: { type: String },
    github: { type: String }
  },
  hasDisability: {
    type: Boolean,
    default: false,
  },
  disabilityDetails: {
    type: {
      type: String,
      enum: ['visual', 'auditory', 'motor', 'cognitive', 'other'],
    },
    accommodations: [String],
    notes: String,
  },
  profession: {
    type: String,
  },
  lastLogin: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);