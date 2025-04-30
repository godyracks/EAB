const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Review = require('../models/Review');
const Technology = require('../models/Technology');
const connectDB = require('../config/db');

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Review.deleteMany({});
    await Technology.deleteMany({});

    // Seed Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      userId: uuidv4(),
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
    });
    await admin.save();

    // Seed User
    const userPassword = await bcrypt.hash('user123', 10);
    const user = new User({
      userId: uuidv4(),
      email: 'user@example.com',
      password: userPassword,
      role: 'user',
    });
    await user.save();

    // Seed Technology
    const tech = new Technology({
      techId: uuidv4(),
      name: 'Technology 1',
      keyFeatures: 'Feature 1\nFeature 2',
      systemRequirements: 'Windows 10, 8GB RAM',
      category: 'visual',
      description: 'A powerful tool for visual assistance.',
      cost: 'free',
      evaluation: 'Highly rated for accessibility.',
      version: '1.2.3',
      platform: 'Windows, macOS',
      developer: 'TechCorp',
      inputs: 'Keyboard, Mouse',
      image: '/uploads/tech-1.jpg',
      featureComparison: {
        security: 'Yes',
        integration: 'Yes',
        support: 'Yes',
        userManagement: 'Yes',
        api: 'Yes',
        webhooks: 'Yes',
        community: 'Yes',
      },
      coreVitals: {
        easeOfUse: 4.5,
        featuresRating: 4.8,
        valueForMoney: 4.2,
        customerSupport: 4.3,
      },
    });
    await tech.save();

    // Seed Review
    const review = new Review({
      reviewId: uuidv4(),
      rating: 4,
      feedback: 'Great experience!',
      tags: ['positive', 'helpful'],
      technologyId: tech.techId,
      userId: user.userId,
    });
    await review.save();

    tech.rating = 4;
    tech.reviewsCount = 1;
    await tech.save();

    console.log('Database seeded successfully');
    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding error:', error);
    mongoose.connection.close();
  }
};

seedData();