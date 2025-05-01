const Technology = require('../models/technology.models');

const createTechnology = async (req, res) => {
  const { name, description, coreVitals, featureComparison, cost, category, tech_img_link, ...otherFields } = req.body;
  try {
    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({ message: 'Name and description are required' });
    }

    // Provide default values for optional fields
    const technologyData = {
      name,
      description,
      coreVitals: coreVitals || {
        customerSupport: 0,
        valueForMoney: 0,
        featuresRating: 0,
        easeOfUse: 0,
      },
      featureComparison: featureComparison || {
        community: false,
        webhooks: false,
        api: false,
        userManagement: false,
        support: false,
        integration: false,
        security: false,
      },
      cost: cost || '',
      category: category || '',
      inputs: otherFields.inputs || '',
      developer: otherFields.developer || '',
      platform: otherFields.platform || '',
      version: otherFields.version || '',
      evaluation: otherFields.evaluation || '',
      systemRequirements: otherFields.systemRequirements || '',
      keyFeatures: otherFields.keyFeatures || '',
      image_url: tech_img_link || '', // Map tech_img_link to image_url
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const technology = new Technology(technologyData);
    await technology.save();
    res.status(201).json(technology);
  } catch (error) {
    console.error('Error creating technology:', error);
    res.status(500).json({ message: error.message });
  }
};

const getAllTechnologies = async (req, res) => {
  try {
    const { category, cost, ratingMin, features } = req.query;
    let query = {};

    if (category) {
      query.category = category.toLowerCase();
    }

    if (cost) {
      query.cost = cost.toLowerCase();
    }

    if (ratingMin) {
      const minRating = parseFloat(ratingMin);
      if (!isNaN(minRating)) {
        query['coreVitals.featuresRating'] = { $gte: minRating };
      }
    }

    if (features) {
      const featureList = features.split(',').map((f) => f.trim().toLowerCase());
      const featureQuery = featureList.reduce((acc, feature) => {
        if (['community', 'webhooks', 'api', 'userManagement', 'support', 'integration', 'security'].includes(feature)) {
          acc[`featureComparison.${feature}`] = true;
        }
        return acc;
      }, {});
      Object.assign(query, featureQuery);
    }

    console.log('Query:', query);
    const technologies = await Technology.find(query);
    res.status(200).json(technologies);
  } catch (error) {
    console.error('Error fetching technologies:', error);
    res.status(500).json({ message: error.message });
  }
};

const getTechnologyById = async (req, res) => {
  try {
    const technology = await Technology.findById(req.params.id);
    if (!technology) {
      return res.status(404).json({ message: 'Technology not found' });
    }
    res.status(200).json(technology);
  } catch (error) {
    console.error('Error fetching technology by ID:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateTechnology = async (req, res) => {
  try {
    const technology = await Technology.findById(req.params.id);
    if (!technology) {
      return res.status(404).json({ message: 'Technology not found' });
    }

    const { name, description, coreVitals, featureComparison, cost, category, tech_img_link, ...otherFields } = req.body;

    if (name !== undefined && !name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (description !== undefined && !description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    technology.name = name !== undefined ? name : technology.name;
    technology.description = description !== undefined ? description : technology.description;
    technology.coreVitals = coreVitals || technology.coreVitals;
    technology.featureComparison = featureComparison || technology.featureComparison;
    technology.cost = cost !== undefined ? cost : technology.cost;
    technology.category = category !== undefined ? category : technology.category;
    technology.inputs = otherFields.inputs !== undefined ? otherFields.inputs : technology.inputs;
    technology.developer = otherFields.developer !== undefined ? otherFields.developer : technology.developer;
    technology.platform = otherFields.platform !== undefined ? otherFields.platform : technology.platform;
    technology.version = otherFields.version !== undefined ? otherFields.version : technology.version;
    technology.evaluation = otherFields.evaluation !== undefined ? otherFields.evaluation : technology.evaluation;
    technology.systemRequirements = otherFields.systemRequirements !== undefined ? otherFields.systemRequirements : technology.systemRequirements;
    technology.keyFeatures = otherFields.keyFeatures !== undefined ? otherFields.keyFeatures : technology.keyFeatures;
    technology.image_url = tech_img_link !== undefined ? tech_img_link : technology.image_url; // Update image_url
    technology.updatedAt = new Date();

    await technology.save();
    res.status(200).json(technology);
  } catch (error) {
    console.error('Error updating technology:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteTechnology = async (req, res) => {
  try {
    const technology = await Technology.findById(req.params.id);
    if (!technology) {
      return res.status(404).json({ message: 'Technology not found' });
    }
    await technology.deleteOne();
    res.status(200).json({ message: 'Technology deleted successfully' });
  } catch (error) {
    console.error('Error deleting technology:', error);
    res.status(500).json({ message: error.message });
  }
};

const searchTechnologies = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const technologies = await Technology.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    });

    res.status(200).json(technologies);
  } catch (error) {
    console.error('Error searching technologies:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createTechnology, getAllTechnologies, getTechnologyById, updateTechnology, deleteTechnology, searchTechnologies };