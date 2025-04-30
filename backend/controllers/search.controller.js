const Search = require('../models/search.models');
const redisClient = require('../redis');
const { searchTechnologies } = require('../services/search.services');

const search = async (req, res) => {
  const { query, rating, popularity, recency, highestRatings, cost, category } = req.query;
  const userId = req.user ? req.user.userId : null;

  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const cacheKey = `search:${query}:${JSON.stringify(req.query)}`;

  try {
    // Check Redis cache
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      return res.status(200).json(JSON.parse(cachedResults));
    }

    // Apply filters (one at a time)
    const filter = {};
    if (rating) filter.rating = rating;
    else if (popularity) filter.popularity = true;
    else if (recency) filter.recency = true;
    else if (highestRatings) filter.highestRatings = true;
    else if (cost) filter.cost = cost;
    else if (category) filter.category = category;

    // Perform search
    const technologies = await searchTechnologies(query, filter);

    // Log the search query
    const searchLog = new Search({
      query,
      userId,
      filters: filter,
    });
    await searchLog.save();

    // Cache the result
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(technologies));

    res.status(200).json(technologies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { search };