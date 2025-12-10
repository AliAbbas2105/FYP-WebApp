import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function Signup() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    // Patient fields
    age: '',
    phone_number: '',
    // Doctor fields
    specialization: '',
    hospital_name: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Use at least 8 characters'
    }
    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (formData.role === 'patient') {
      if (!formData.age || parseInt(formData.age) <= 0) {
        newErrors.age = 'Valid age is required'
      }
      if (!formData.phone_number.trim()) {
        newErrors.phone_number = 'Phone number is required'
      }
    } else if (formData.role === 'doctor') {
      if (!formData.specialization.trim()) {
        newErrors.specialization = 'Specialization is required'
      }
      if (!formData.hospital_name.trim()) {
        newErrors.hospital_name = 'Hospital name is required'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setSuccessMessage('')
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role
      }
      
      if (formData.role === 'patient') {
        payload.age = parseInt(formData.age)
        payload.phone_number = formData.phone_number
      } else {
        payload.specialization = formData.specialization
        payload.hospital_name = formData.hospital_name
      }
      
      const response = await api.post('/auth/signup', payload)
      setSuccessMessage(response.data.message || 'Account created successfully! Please check your email to verify your account.')
      
      // Don't auto-redirect, let user read the message and manually go to login
      // They can click the link when ready
    } catch (error) {
      if (error.response) {
        const message = error.response.data.detail || 'Signup failed. Try again.'
        if (error.response.data.detail?.includes('email')) {
          setErrors({ email: message })
        } else if (error.response.data.detail?.includes('username')) {
          setErrors({ username: message })
        } else {
          setErrors({ email: message })
        }
      } else {
        setErrors({ email: 'Signup failed. Try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Create account</h2>
        {successMessage && (
          <div style={{ 
            color: 'var(--accent)', 
            marginBottom: '20px', 
            padding: '16px', 
            background: 'rgba(124,245,161,0.15)', 
            borderRadius: '12px',
            border: '1px solid rgba(124,245,161,0.3)',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>✓ Account Created Successfully!</strong>
            {successMessage}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(124,245,161,0.2)' }}>
              <Link to="/login" className="btn primary" style={{ marginTop: '8px', display: 'inline-block' }}>
                Go to Login
              </Link>
            </div>
          </div>
        )}
        <form id="signup-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="signup-username">Username</label>
            <input
              className="input"
              id="signup-username"
              type="text"
              autoComplete="username"
              required
              placeholder="johndoe"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.username && <div className="error">{errors.username}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-email">Email</label>
            <input
              className="input"
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@hospital.org"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.email && <div className="error">{errors.email}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-password">Password</label>
            <input
              className="input"
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.password && <div className="error">{errors.password}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-confirm">Confirm password</label>
            <input
              className="input"
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.confirmPassword && <div className="error">{errors.confirmPassword}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="signup-role">I am a</label>
            <select
              className="input"
              id="signup-role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          
          {formData.role === 'patient' && (
            <>
              <div className="field">
                <label className="label" htmlFor="signup-age">Age</label>
                <input
                  className="input"
                  id="signup-age"
                  type="number"
                  required
                  placeholder="25"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  disabled={isLoading}
                  min="1"
                  max="150"
                />
                {errors.age && <div className="error">{errors.age}</div>}
              </div>
              <div className="field">
                <label className="label" htmlFor="signup-phone">Phone Number</label>
                <input
                  className="input"
                  id="signup-phone"
                  type="tel"
                  required
                  placeholder="+1234567890"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.phone_number && <div className="error">{errors.phone_number}</div>}
              </div>
            </>
          )}
          
          {formData.role === 'doctor' && (
            <>
              <div className="field">
                <label className="label" htmlFor="signup-specialization">Specialization</label>
                <input
                  className="input"
                  id="signup-specialization"
                  type="text"
                  required
                  placeholder="Gastroenterology"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.specialization && <div className="error">{errors.specialization}</div>}
              </div>
              <div className="field">
                <label className="label" htmlFor="signup-hospital">Hospital Name</label>
                <input
                  className="input"
                  id="signup-hospital"
                  type="text"
                  required
                  placeholder="City Medical Center"
                  name="hospital_name"
                  value={formData.hospital_name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.hospital_name && <div className="error">{errors.hospital_name}</div>}
              </div>
            </>
          )}
          
          <div className="divider"></div>
          <button className="btn primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
          <span className="help" style={{ marginLeft: '10px' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </span>
        </form>
      </div>
      <div className="card">
        <h3>Your privacy, our priority</h3>
        <p className="help">Your health deserves precision — and your privacy deserves protection.</p>
      </div>
    </section>
  )
}

export default Signup

