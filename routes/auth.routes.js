const express = require('express');
const router = express.Router();
const { register, login, verifyOTP, getProfile, updateProfile, uploadAvatar, completeProfile } = require('../controllers/auth.controllers');
const authMiddleware = require('../middleware/auth.middlewares');
const multer = require('multer');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/avatar', authMiddleware, upload.single('avatar'), uploadAvatar);
router.post('/complete-profile', authMiddleware, completeProfile);

module.exports = router;