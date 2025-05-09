const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.models');
const { sendOTP } = require('../services/email.services');
const redisClient = require('../redis');

// In-memory fallback storage for OTPs
const inMemoryStorage = {
  otps: new Map(),
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Store OTP with fallback to in-memory storage
const storeOTP = async (userId, otp) => {
  console.log(`Storing OTP for userId: ${userId}`);
  try {
    await redisClient.set(`otp:${userId}`, otp, { EX: 600 }); // Expire after 10 minutes
    console.log('OTP stored in Redis');
    return true;
  } catch (error) {
    console.warn('Failed to store OTP in Redis, falling back to in-memory storage:', error);
    inMemoryStorage.otps.set(`otp:${userId}`, otp);
    setTimeout(() => inMemoryStorage.otps.delete(`otp:${userId}`), 600 * 1000);
    console.log('OTP stored in in-memory storage');
    return true;
  }
};

// Verify OTP with fallback to in-memory storage
const verifyStoredOTP = async (userId, otp) => {
  try {
    let storedOTP;
    try {
      storedOTP = await redisClient.get(`otp:${userId}`);
    } catch (error) {
      console.warn('Failed to fetch OTP from Redis, checking in-memory storage:', error);
      storedOTP = inMemoryStorage.otps.get(`otp:${userId}`);
    }

    console.log(`Stored OTP: "${storedOTP}" (type: ${typeof storedOTP})`);
    console.log(`Provided OTP: "${otp}" (type: ${typeof otp})`);

    if (!storedOTP) {
      throw new Error('OTP expired or not found');
    }

    if (storedOTP !== otp) {
      console.log(`OTP comparison failed: "${storedOTP}" !== "${otp}"`);
      throw new Error('Invalid OTP');
    }

    // Clean up after verification
    try {
      await redisClient.del(`otp:${userId}`);
    } catch (error) {
      console.warn('Failed to clean up OTP in Redis, proceeding:', error);
    }
    inMemoryStorage.otps.delete(`otp:${userId}`);

    return true;
  } catch (error) {
    console.error('OTP verification error:', error);
    throw new Error(error.message || 'Failed to verify OTP');
  }
};

const register = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user = new User({
      email,
      password: hashedPassword,
      role: role || 'user',
      otp,
      otpExpires,
    });

    await user.save();
    await storeOTP(user.userId, otp);

    try {
      await sendOTP(email, otp);
      res.status(201).json({ message: 'User registered. Please verify OTP.', userId: user.userId });
    } catch (emailError) {
      console.error('Failed to send OTP during registration:', emailError);
      res.status(201).json({ 
        message: 'User registered, but failed to send OTP. Please use this OTP to verify: ' + otp,
        userId: user.userId
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Verify OTP using Redis/in-memory storage
    await verifyStoredOTP(user.userId, otp);

    // Clear OTP fields in the database
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await storeOTP(user.userId, otp);

    try {
      await sendOTP(email, otp);
      res.status(200).json({ message: 'OTP sent to email', userId: user.userId });
    } catch (emailError) {
      console.error('Failed to send OTP during login:', emailError);
      res.status(200).json({ 
        message: 'Login successful, but failed to send OTP. Please use this OTP to verify: ' + otp,
        userId: user.userId
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId }).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }

    await user.save();
    res.status(200).json({
      userId: user.userId,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, verifyOTP, login, getProfile, updateProfile };