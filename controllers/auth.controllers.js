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

const storeOTP = async (userId, otp) => {
  console.log(`[storeOTP] Storing OTP for userId: ${userId}`);
  try {
    await redisClient.set(`otp:${userId}`, otp, { EX: 600 });
    console.log(`[storeOTP] OTP stored in Redis for userId: ${userId}`);
    return true;
  } catch (error) {
    console.warn(`[storeOTP] Failed to store OTP in Redis for userId: ${userId}, falling back to in-memory storage:`, error.message);
    inMemoryStorage.otps.set(`otp:${userId}`, otp);
    setTimeout(() => inMemoryStorage.otps.delete(`otp:${userId}`), 600 * 1000);
    console.log(`[storeOTP] OTP stored in in-memory storage for userId: ${userId}`);
    return true;
  }
};

const verifyStoredOTP = async (userId, otp) => {
  try {
    let storedOTP;
    try {
      storedOTP = await redisClient.get(`otp:${userId}`);
      console.log(`[verifyStoredOTP] Fetched OTP from Redis for userId: ${userId}: ${storedOTP}`);
    } catch (error) {
      console.warn(`[verifyStoredOTP] Failed to fetch OTP from Redis for userId: ${userId}, checking in-memory storage:`, error.message);
      storedOTP = inMemoryStorage.otps.get(`otp:${userId}`);
      console.log(`[verifyStoredOTP] Fetched OTP from in-memory storage for userId: ${userId}: ${storedOTP}`);
    }

    console.log(`[verifyStoredOTP] Comparing stored OTP: "${storedOTP}" (type: ${typeof storedOTP}) with provided OTP: "${otp}" (type: ${typeof otp})`);

    if (!storedOTP) {
      console.error(`[verifyStoredOTP] OTP expired or not found for userId: ${userId}`);
      throw new Error('OTP expired or not found');
    }

    if (storedOTP !== otp) {
      console.error(`[verifyStoredOTP] OTP comparison failed for userId: ${userId}: "${storedOTP}" !== "${otp}"`);
      throw new Error('Invalid OTP');
    }

    try {
      await redisClient.del(`otp:${userId}`);
      console.log(`[verifyStoredOTP] Cleaned up OTP in Redis for userId: ${userId}`);
    } catch (error) {
      console.warn(`[verifyStoredOTP] Failed to clean up OTP in Redis for userId: ${userId}, proceeding:`, error.message);
    }
    inMemoryStorage.otps.delete(`otp:${userId}`);
    console.log(`[verifyStoredOTP] Cleaned up OTP in in-memory storage for userId: ${userId}`);

    return true;
  } catch (error) {
    console.error(`[verifyStoredOTP] OTP verification error for userId: ${userId}:`, error.message);
    throw new Error(error.message || 'Failed to verify OTP');
  }
};

const register = async (req, res) => {
  console.log('[register] Incoming request:', {
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: req.url,
  });

  const { email, password, role, hasDisability } = req.body;

  console.log('[register] Parsed request body:', { email, password, role, hasDisability });

  if (!email || !password) {
    console.error('[register] Validation failed: Missing email or password');
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    console.log('[register] Checking for existing user with email:', email);
    let user = await User.findOne({ email });
    if (user) {
      console.error('[register] User already exists with email:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    console.log('[register] Hashing password');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[register] Password hashed successfully');

    const otp = generateOTP();
    console.log('[register] Generated OTP:', otp);

    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log('[register] Creating new user');
    user = new User({
      email,
      password: hashedPassword,
      role: role || 'user',
      hasDisability: hasDisability || false,
      otp,
      otpExpires,
    });

    console.log('[register] User object before save:', {
      email: user.email,
      role: user.role,
      hasDisability: user.hasDisability,
      otp: user.otp,
      otpExpires: user.otpExpires,
    });

    console.log('[register] Saving user to database');
    await user.save();
    console.log('[register] User saved successfully:', { userId: user.userId, email });

    console.log('[register] Storing OTP');
    await storeOTP(user.userId, otp);
    console.log('[register] OTP stored successfully');

    try {
      console.log('[register] Sending OTP to email:', email);
      await sendOTP(email, otp);
      console.log('[register] OTP sent successfully');
      res.status(201).json({ message: 'User registered. Please verify OTP.', userId: user.userId });
    } catch (emailError) {
      console.error('[register] Failed to send OTP during registration:', emailError.message);
      res.status(201).json({ 
        message: 'User registered, but failed to send OTP. Please use this OTP to verify: ' + otp,
        userId: user.userId
      });
    }
  } catch (error) {
    console.error('[register] Error during registration:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

const verifyOTP = async (req, res) => {
  const { userId, otp } = req.body;

  console.log('[verifyOTP] Incoming request:', { userId, otp });

  try {
    console.log('[verifyOTP] Finding user with userId:', userId);
    const user = await User.findOne({ userId });
    if (!user) {
      console.error('[verifyOTP] User not found for userId:', userId);
      return res.status(400).json({ message: 'User not found' });
    }

    console.log('[verifyOTP] Verifying stored OTP');
    await verifyStoredOTP(userId, otp);

    console.log('[verifyOTP] Clearing OTP fields');
    user.otp = null;
    user.otpExpires = null;
    user.lastLogin = new Date();
    await user.save();
    console.log('[verifyOTP] User updated successfully:', { userId });

    console.log('[verifyOTP] Generating JWT');
    const token = jwt.sign(
      { 
        userId: user.userId, 
        email: user.email, 
        role: user.role, 
        hasDisability: user.hasDisability,
        disabilityDetailsCompleted: !!user.disabilityDetails?.type 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('[verifyOTP] JWT generated successfully');

    res.status(200).json({ token });
  } catch (error) {
    console.error('[verifyOTP] Error during OTP verification:', error.message);
    res.status(400).json({ message: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  console.log('[login] Incoming request:', { email, password });

  try {
    console.log('[login] Finding user with email:', email);
    const user = await User.findOne({ email });
    if (!user) {
      console.error('[login] User not found for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[login] Comparing passwords');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('[login] Password mismatch for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('[login] Generating OTP');
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.lastLogin = new Date();
    console.log('[login] Saving user with OTP');
    await user.save();
    console.log('[login] User saved successfully:', { userId: user.userId });

    console.log('[login] Storing OTP');
    await storeOTP(user.userId, otp);

    try {
      console.log('[login] Sending OTP to email:', email);
      await sendOTP(email, otp);
      console.log('[login] OTP sent successfully');
      res.status(200).json({ message: 'OTP sent to email', userId: user.userId });
    } catch (emailError) {
      console.error('[login] Failed to send OTP during login:', emailError.message);
      res.status(200).json({ 
        message: 'Login successful, but failed to send OTP. Please use this OTP to verify: ' + otp,
        userId: user.userId
      });
    }
  } catch (error) {
    console.error('[login] Error during login:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    console.log('[getProfile] Fetching profile for userId:', req.user.userId);
    const user = await User.findOne({ userId: req.user.userId }).select('-password -otp -otpExpires');
    if (!user) {
      console.error('[getProfile] User not found for userId:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('[getProfile] Profile fetched successfully:', { userId: user.userId });
    res.status(200).json(user);
  } catch (error) {
    console.error('[getProfile] Error fetching profile:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  const { email, socialLinks } = req.body;

  console.log('[updateProfile] Incoming request:', { userId: req.user.userId, email, socialLinks });

  try {
    console.log('[updateProfile] Finding user with userId:', req.user.userId);
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      console.error('[updateProfile] User not found for userId:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email !== user.email) {
      console.log('[updateProfile] Checking for existing email:', email);
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.error('[updateProfile] Email already in use:', email);
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
      console.log('[updateProfile] Updated email:', email);
    }

    if (socialLinks) {
      user.socialLinks = {
        twitter: socialLinks.twitter || user.socialLinks?.twitter,
        linkedin: socialLinks.linkedin || user.socialLinks?.linkedin,
        github: socialLinks.github || user.socialLinks?.github
      };
      console.log('[updateProfile] Updated socialLinks:', user.socialLinks);
    }

    console.log('[updateProfile] Saving user');
    await user.save();
    console.log('[updateProfile] User saved successfully');

    res.status(200).json({
      userId: user.userId,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      socialLinks: user.socialLinks,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      hasDisability: user.hasDisability,
      disabilityDetails: user.disabilityDetails,
      profession: user.profession
    });
  } catch (error) {
    console.error('[updateProfile] Error updating profile:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    console.log('[uploadAvatar] Processing avatar upload for userId:', req.user.userId);
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      console.error('[uploadAvatar] User not found for userId:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      console.error('[uploadAvatar] No file uploaded for userId:', req.user.userId);
      return res.status(400).json({ message: 'No file uploaded' });
    }

    user.avatar = `/uploads/${req.file.filename}`;
    console.log('[uploadAvatar] Saving avatar:', user.avatar);
    await user.save();

    console.log('[uploadAvatar] Avatar uploaded successfully for userId:', req.user.userId);
    res.status(200).json({
      message: 'Avatar uploaded successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('[uploadAvatar] Error uploading avatar:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const completeProfile = async (req, res) => {
  const { disabilityType, accommodations, accessibilityNotes, profession } = req.body;

  console.log('[completeProfile] Incoming request:', { userId: req.user.userId, disabilityType, accommodations, accessibilityNotes, profession });

  try {
    console.log('[completeProfile] Finding user with userId:', req.user.userId);
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      console.error('[completeProfile] User not found for userId:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.hasDisability) {
      console.error('[completeProfile] Profile completion attempted by non-disabled user:', req.user.userId);
      return res.status(403).json({ message: 'Profile completion is only for users with disabilities' });
    }

    user.disabilityDetails = {
      type: disabilityType,
      accommodations: accommodations || [],
      notes: accessibilityNotes || '',
    };
    user.profession = profession || '';
    console.log('[completeProfile] Updating user with:', user.disabilityDetails, { profession });

    console.log('[completeProfile] Saving user');
    await user.save();
    console.log('[completeProfile] User saved successfully');

    res.status(200).json({
      message: 'Profile completed successfully',
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role,
        hasDisability: user.hasDisability,
        disabilityDetails: user.disabilityDetails,
        profession: user.profession,
      },
    });
  } catch (error) {
    console.error('[completeProfile] Error completing profile:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, verifyOTP, login, getProfile, updateProfile, uploadAvatar, completeProfile };