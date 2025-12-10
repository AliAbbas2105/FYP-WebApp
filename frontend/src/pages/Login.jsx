import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    
    if (!email) {
      setErrors({ email: 'Email is required' })
      return
    }
    if (!password) {
      setErrors({ password: 'Password is required' })
      return
    }

    setIsLoading(true)
    try {
      const response = await api.post('/auth/login', { email, password })
      login(response.data.access_token, response.data.user)
      navigate('/')
    } catch (error) {
      if (error.response) {
        const message = error.response.data.detail || 'Login failed. Try again.'
        setErrors({ password: message })
      } else {
        setErrors({ password: 'Login failed. Try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Log in</h2>
        <form id="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="login-email">Email</label>
            <input
              className="input"
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@hospital.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            {errors.email && <div className="error">{errors.email}</div>}
          </div>
          <div className="field">
            <label className="label" htmlFor="login-password">Password</label>
            <input
              className="input"
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            {errors.password && <div className="error">{errors.password}</div>}
          </div>
          <div className="divider"></div>
          <button className="btn primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
          <span className="help" style={{ marginLeft: '10px' }}>
            No account? <Link to="/signup">Sign up</Link>
          </span>
        </form>
      </div>
      <div className="card">
        <h3>Secure Collaboration</h3>
        <p className="help">Participate in global model training without exposing patient-level data.</p>
      </div>
    </section>
  )
}

export default Login

