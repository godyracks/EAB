const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controllers');
const authMiddleware = require('../middleware/auth.middlewares');

router.post('/', authMiddleware, reviewController.createReview);
router.get('/', reviewController.getAllReviews); // Added
router.get('/:id', reviewController.getReviewById); // Added
router.put('/:id', authMiddleware, reviewController.updateReview);
router.delete('/:id', authMiddleware, reviewController.deleteReview);

module.exports = router;