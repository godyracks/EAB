const Review = require('../models/review.models');
const mongoose = require('mongoose');

const createReview = async (req, res) => {
  const { technologyId, rating, comment, tags } = req.body;
  const userId = req.user.userId;

  // Validate request body
  if (!technologyId || !mongoose.isValidObjectId(technologyId)) {
    return res.status(400).json({ message: 'Invalid or missing technologyId' });
  }
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
  }
  if (!comment || typeof comment !== 'string' || comment.trim() === '') {
    return res.status(400).json({ message: 'Comment is required and must be a non-empty string' });
  }
  if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
    return res.status(400).json({ message: 'Tags must be an array of strings' });
  }

  try {
    // Verify technology exists
    const technology = await mongoose.model('Technology').findById(technologyId);
    if (!technology) {
      return res.status(404).json({ message: 'Technology not found' });
    }

    // Verify user exists by userId (UUID string)
    const user = await mongoose.model('User').findOne({ userId: userId }, 'userId email socialLinks');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const review = new Review({
      technologyId,
      userId,
      rating,
      comment,
      tags: tags || [],
    });

    await review.save();
    // Populate technologyId and return user data for response
    const populatedReview = await Review.findById(review._id)
      .populate('technologyId', 'name description')
      .lean();
    res.status(201).json({
      ...populatedReview,
      userId: { userId: user.userId, email: user.email, socialLinks: user.socialLinks || {} },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('technologyId', 'name description')
      .lean();
    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const user = await mongoose.model('User').findOne({ userId: review.userId }, 'userId email socialLinks').lean();
        return {
          ...review,
          userId: user ? { userId: user.userId, email: user.email, socialLinks: user.socialLinks || {} } : null,
        };
      })
    );
    res.status(200).json(populatedReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReviewById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid review ID' });
  }
  try {
    const review = await Review.findById(id)
      .populate('technologyId', 'name description')
      .lean();
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    const user = await mongoose.model('User').findOne({ userId: review.userId }, 'userId email socialLinks').lean();
    res.status(200).json({
      ...review,
      userId: user ? { userId: user.userId, email: user.email, socialLinks: user.socialLinks || {} } : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateReview = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid review ID' });
  }
  try {
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { rating, comment, tags } = req.body;
    if (rating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }
    if (comment && (typeof comment !== 'string' || comment.trim() === '')) {
      return res.status(400).json({ message: 'Comment must be a non-empty string' });
    }
    if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
      return res.status(400).json({ message: 'Tags must be an array of strings' });
    }
    Object.assign(review, req.body);
    await review.save();
    const populatedReview = await Review.findById(id)
      .populate('technologyId', 'name description')
      .lean();
    const user = await mongoose.model('User').findOne({ userId: review.userId }, 'userId email socialLinks').lean();
    res.status(200).json({
      ...populatedReview,
      userId: user ? { userId: user.userId, email: user.email, socialLinks: user.socialLinks || {} } : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid review ID' });
  }
  try {
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await review.deleteOne();
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReviewsByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const reviews = await Review.find({ userId })
      .populate('technologyId', 'name description')
      .lean();
    if (!reviews.length) {
      return res.status(404).json({ message: 'No reviews found for this user' });
    }
    const user = await mongoose.model('User').findOne({ userId }, 'userId email socialLinks').lean();
    const populatedReviews = reviews.map(review => ({
      ...review,
      userId: user ? { userId: user.userId, email: user.email, socialLinks: user.socialLinks || {} } : null,
    }));
    res.status(200).json(populatedReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getReviewsByUserId,
};