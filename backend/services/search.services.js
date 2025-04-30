const Technology = require('../models/technology.models');
const Review = require('../models/review.models');
const mongoose = require('mongoose');

const searchTechnologies = async (query, filter = {}) => {
  // Step 1: Build search criteria with text search
  const searchCriteria = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { keyFeatures: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } },
    ],
  };

  // Step 2: Include technologies with matching review tags
  const reviews = await Review.find({
    tags: { $elemMatch: { $regex: query, $options: 'i' } },
  });
  const techIdsFromReviews = reviews
    .map(review => review.technologyId.toString())
    .filter(id => mongoose.isValidObjectId(id));
  if (techIdsFromReviews.length > 0) {
    searchCriteria.$or.push({
      _id: { $in: techIdsFromReviews.map(id => new mongoose.Types.ObjectId(id)) },
    });
  }

  // Step 3: Build aggregation pipeline
  const pipeline = [
    { $match: searchCriteria },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'technologyId',
        as: 'reviews',
      },
    },
    {
      $addFields: {
        avgRating: {
          $cond: {
            if: { $eq: [{ $size: '$reviews' }, 0] },
            then: 0,
            else: { $avg: '$reviews.rating' },
          },
        },
        reviewsCount: { $size: '$reviews' },
      },
    },
  ];

  // Step 4: Apply filters
  let sortOption = { avgRating: -1, reviewsCount: -1 };
  if (filter.rating) {
    pipeline.push({ $match: { avgRating: { $gte: parseFloat(filter.rating) } } });
  }
  if (filter.popularity) {
    sortOption = { reviewsCount: -1, avgRating: -1 };
  }
  if (filter.recency) {
    sortOption = { createdAt: -1 };
  }
  if (filter.highestRatings) {
    pipeline.push({ $match: { avgRating: { $gte: 4 } } });
  }
  if (filter.cost) {
    pipeline.push({ $match: { cost: filter.cost } });
  }
  if (filter.category) {
    pipeline.push({ $match: { category: { $regex: filter.category, $options: 'i' } } });
  }

  // Step 5: Sort and limit results
  pipeline.push(
    { $sort: sortOption },
    { $limit: 20 },
    {
      $project: {
        name: 1,
        description: 1,
        keyFeatures: 1,
        category: 1,
        cost: 1,
        avgRating: 1,
        reviewsCount: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    }
  );

  // Step 6: Execute aggregation
  const technologies = await Technology.aggregate(pipeline);

  return technologies;
};

module.exports = { searchTechnologies };