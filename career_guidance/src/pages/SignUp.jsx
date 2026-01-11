import { auth, createUserWithEmailAndPassword } from "../firebase";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import './Auth.css';

export default function SignUp() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError("Please enter your email");

      
      return;
    }

    try {
      setError("");
      setLoading(true);
      
      const response = await axios.post('https://careerguidance-10.onrender.com/api/send-otp', {
        email
      });

      if (response.data.success) {
        setStep(2);
        setError("");
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      setError("Please enter 6-digit OTP");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const response = await axios.post('https://careerguidance-10.onrender.com/api/verify-otp', {
        email,
        otp
      });

      if (response.data.success) {
        setStep(3);
        setError("");
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Create Account
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Email already registered. Please login.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>
            {step === 1 && 'Enter your email to get started'}
            {step === 2 && 'Verify your email address'}
            {step === 3 && 'Set your password'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Step 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className="auth-form">
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <div className="otp-info">
              <p>We've sent a 6-digit code to</p>
              <p style={{ fontWeight: 600, color: '#667eea' }}>{email}</p>
            </div>
            <div className="input-group">
              <label>Enter OTP</label>
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                maxLength={6}
                style={{ letterSpacing: '8px', fontSize: '24px', textAlign: 'center' }}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button 
              type="button" 
              onClick={() => setStep(1)} 
              className="btn-secondary"
              disabled={loading}
            >
              Change Email
            </button>
          </form>
        )}

        {/* Step 3: Password Setup */}
        {step === 3 && (
          <form onSubmit={handleCreateAccount} className="auth-form">
            <div className="input-group">
              <label>Username (Email)</label>
              <input
                type="text"
                value={email}
                disabled
                style={{ background: '#f7fafc' }}
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link to="/">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
