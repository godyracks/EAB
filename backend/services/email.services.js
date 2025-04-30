const { Resend } = require('resend');

const sendOTP = async (email, otp) => {
  console.log(`Sending OTP email to: ${email}`);

  // Log environment variables at the time of sending
  console.log('Resend API Key:', process.env.RESEND_API_KEY ? 'Set' : 'Not set');
  console.log('From Email:', process.env.FROM_EMAIL || 'Not set');

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'no-reply@yourdomain.com';

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set. Cannot send OTP email.');
    throw new Error('Email service unavailable: RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Your OTP Code - TechApp',
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    });

    if (error) {
      console.error('Resend email error:', error);
      throw new Error('Failed to send OTP email: ' + error.message);
    }

    console.log('Email sent via Resend:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP: ' + error.message);
  }
};

module.exports = { sendOTP };