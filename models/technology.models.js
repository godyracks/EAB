const mongoose = require('mongoose');

const technologySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  coreVitals: {
    customerSupport: { type: Number },
    valueForMoney: { type: Number },
    featuresRating: { type: Number },
    easeOfUse: { type: Number },
  },
  featureComparison: {
    community: { type: Boolean },
    webhooks: { type: Boolean },
    api: { type: Boolean },
    userManagement: { type: Boolean },
    support: { type: Boolean },
    integration: { type: Boolean },
    security: { type: Boolean },
  },
  inputs: { type: String },
  developer: { type: String },
  platform: { type: String },
  version: { type: String },
  evaluation: { type: String },
  cost: { type: String },
  category: { type: String },
  systemRequirements: { type: String },
  keyFeatures: { type: String },
  image_url: { type: String }, // New field for storing image URL
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

technologySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Technology', technologySchema);