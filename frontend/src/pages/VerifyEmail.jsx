import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    const verifyEmail = async () => {
      try {
        // searchParams.get() already decodes the token, so we pass it as-is
        const response = await api.get('/auth/verify-email', {
          params: { token }
        })
        setStatus('success')
        setMessage(response.data.message || 'Email verified successfully!')
      } catch (error) {
        setStatus('error')
        setMessage(error.response?.data?.detail || 'Verification failed. The token may be invalid or expired.')
      }
    }

    verifyEmail()
  }, [searchParams])

  return (
    <section className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Email Verification</h2>
      <div className="divider"></div>
      {status === 'verifying' && (
        <p className="help">Verifying your email...</p>
      )}
      {status === 'success' && (
        <>
          <div style={{ 
            color: 'var(--accent)', 
            marginBottom: '20px', 
            padding: '16px', 
            background: 'rgba(124,245,161,0.15)', 
            borderRadius: '12px',
            border: '1px solid rgba(124,245,161,0.3)'
          }}>
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '18px' }}>✓ Email Verified!</strong>
            <p style={{ margin: 0 }}>{message}</p>
          </div>
          <Link to="/login" className="btn primary">Go to Login</Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ 
            color: 'var(--danger)', 
            marginBottom: '20px', 
            padding: '16px', 
            background: 'rgba(255,107,107,0.1)', 
            borderRadius: '12px',
            border: '1px solid rgba(255,107,107,0.3)'
          }}>
            <strong style={{ display: 'block', marginBottom: '8px' }}>Verification Failed</strong>
            <p style={{ margin: 0 }}>{message}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn ghost">Try Login</Link>
            <Link to="/signup" className="btn primary">Sign Up Again</Link>
          </div>
        </>
      )}
    </section>
  )
}

export default VerifyEmail

