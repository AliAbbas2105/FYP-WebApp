import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

function Dashboard() {
  const { user } = useAuth()
  const [imageHistory, setImageHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/image/history')
        setImageHistory(response.data || [])
      } catch (error) {
        console.error('Failed to fetch image history:', error)
        setImageHistory([])
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchHistory()
    }
  }, [user])

  const parseResult = (resultStr) => {
    if (!resultStr) return { label: 'Pending', confidence: null }
    try {
      return JSON.parse(resultStr)
    } catch {
      // If not JSON, try to parse as "label:confidence"
      const parts = resultStr.split(':')
      if (parts.length === 2) {
        return {
          label: parts[0],
          confidence: parseFloat(parts[1])
        }
      }
      return { label: resultStr, confidence: null }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return (
    <section className="card">
      <h2>Welcome to your dashboard, {user?.username}</h2>
      <p className="help">Your dashboard with account details and image analysis history.</p>
      <div className="divider"></div>

      {/* User Details Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Account Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <div className="feature">
            <h4>Role</h4>
            <p style={{ textTransform: 'capitalize' }}>{user?.role || 'N/A'}</p>
          </div>
          <div className="feature">
            <h4>Email</h4>
            <p>{user?.email || 'N/A'}</p>
          </div>
          {user?.role === 'patient' && (
            <>
              {user?.age && (
                <div className="feature">
                  <h4>Age</h4>
                  <p>{user.age} years</p>
                </div>
              )}
              {user?.phone_number && (
                <div className="feature">
                  <h4>Phone Number</h4>
                  <p>{user.phone_number}</p>
                </div>
              )}
            </>
          )}
          {user?.role === 'doctor' && (
            <>
              {user?.specialization && (
                <div className="feature">
                  <h4>Specialization</h4>
                  <p>{user.specialization}</p>
                </div>
              )}
              {user?.hospital_name && (
                <div className="feature">
                  <h4>Hospital</h4>
                  <p>{user.hospital_name}</p>
                </div>
              )}
              {user?.doctor_id && (
                <div className="feature">
                  <h4>Doctor ID</h4>
                  <p style={{ fontSize: '12px', fontFamily: 'monospace' }}>{user.doctor_id}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="divider"></div>

      {/* Statistics Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="feature">
            <h4>Total Images</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--brand-accent)' }}>
              {imageHistory.length}
            </p>
          </div>
          <div className="feature">
            <h4>Analyzed Images</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>
              {imageHistory.filter(img => img.result).length}
            </p>
          </div>
          <div className="feature">
            <h4>Pending Analysis</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--muted)' }}>
              {imageHistory.filter(img => !img.result).length}
            </p>
          </div>
        </div>
      </div>

      <div className="divider"></div>

      {/* Image History Section */}
      <div>
        <h3 style={{ marginBottom: '12px' }}>Image History</h3>
        {loading ? (
          <p className="help">Loading history...</p>
        ) : imageHistory.length === 0 ? (
          <p className="help">No images uploaded yet. Upload your first image from the Home page.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {imageHistory.map((image) => {
              const result = parseResult(image.result)
              const confidencePct = result.confidence ? Math.round(result.confidence * 100) : null
              
              return (
                <div key={image.image_id} className="feature" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '14px' }}>Upload Date:</strong>
                        <span className="help">{formatDate(image.upload_date)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <strong style={{ fontSize: '14px' }}>Image ID:</strong>
                        <span className="help" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {image.image_id}
                        </span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      {result.label && result.label !== 'Pending' ? (
                        <>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>Result:</strong>
                            <span style={{
                              textTransform: 'capitalize',
                              color: result.label === 'cancerous' ? 'var(--danger)' : 'var(--accent)',
                              fontWeight: 600
                            }}>
                              {result.label}
                            </span>
                          </div>
                          {confidencePct !== null && (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <strong style={{ fontSize: '14px' }}>Confidence:</strong>
                              <span style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>
                                {confidencePct}%
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="help">Analysis pending</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default Dashboard
