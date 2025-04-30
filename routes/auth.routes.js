const express = require('express');
const router = express.Router();
const { register, login, verifyOTP } = require('../controllers/auth.controllers');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);

module.exports = router;