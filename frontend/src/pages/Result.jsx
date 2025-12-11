import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function Result() {
  const [data, setData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [doctorError, setDoctorError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const raw = sessionStorage.getItem('gc_last_result')
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw)
      if (parsed.imageDataUrl && parsed.inference) {
        setData(parsed)
      } else {
        sessionStorage.removeItem('gc_last_result')
      }
    } catch {
      sessionStorage.removeItem('gc_last_result')
    }
  }, [])

  // Fetch the latest result from backend to ensure we're not showing stale/session-only data
  useEffect(() => {
    const fetchLatest = async () => {
      if (!data?.imageId) return
      setRefreshing(true)
      try {
        const res = await api.get(`/image/${data.imageId}`)
        if (res.data?.result) {
          const parsed =
            typeof res.data.result === 'string'
              ? JSON.parse(res.data.result)
              : res.data.result

          const imageUrl = res.data.image_path
            ? `http://localhost:8000${res.data.image_path}`
            : data.imageDataUrl

          const updated = {
            imageDataUrl: imageUrl,
            inference: parsed,
            imageId: data.imageId,
          }
          setData(updated)
          sessionStorage.setItem('gc_last_result', JSON.stringify(updated))
        }
      } catch (err) {
        console.error('Failed to refresh result', err)
      } finally {
        setRefreshing(false)
      }
    }
    fetchLatest()
  }, [data?.imageId])

  useEffect(() => {
    const fetchDoctors = async (lat, lng) => {
      try {
        const res = await api.get('/auth/doctors/nearby', {
          params: {
            lat,
            lng,
            radius_km: 15,
            limit: 10,
          },
        })
        setDoctors(res.data || [])
        setDoctorError('')
      } catch (err) {
        setDoctorError(err.response?.data?.detail || 'Unable to load nearby doctors')
        setDoctors([])
      }
    }

    if (!navigator.geolocation) {
      fetchDoctors(undefined, undefined)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        fetchDoctors(latitude, longitude)
      },
      () => {
        // Permission denied or unavailable: fallback to static list
        fetchDoctors(undefined, undefined)
      },
      { timeout: 8000 }
    )
  }, [])

  if (!data) {
    return (
      <section className="card">
        <h2>No result available</h2>
        <p className="help">Please upload an image on the home page to run analysis.</p>
        <div className="divider"></div>
        <button className="btn" onClick={() => navigate('/')}>
          Go to upload
        </button>
      </section>
    )
  }

  const { imageDataUrl, inference } = data
  const confidencePct = Math.round(inference.confidence * 100)

  const buildRecommendations = (confidence) => {
    const pct = Math.round(confidence * 100)
    if (confidence >= 0.8) {
      return [
        `High confidence (${pct}%). Consult a specialist for confirmation and next steps.`,
        'Share the full report and clinical context with your clinician.',
        'Plan appropriate follow-up or further diagnostics as advised.'
      ]
    }
    if (confidence >= 0.5) {
      return [
        `Moderate confidence (${pct}%). Consider additional review or imaging if available.`,
        'Discuss the finding with a clinician to decide next actions.',
        'Ensure image quality is adequate before final conclusions.'
      ]
    }
    return [
      `Low confidence (${pct}%). Acquire clearer imagery or additional views if possible.`,
      'Re-run analysis after quality check; consult a clinician if concerns persist.',
      'Use results as supportive information, not a sole diagnostic.'
    ]
  }

  const recommendations = buildRecommendations(inference.confidence)
  const verdict = `Predicted class: ${inference.label}`

  return (
    <section className="card">
      <h2>Result {refreshing ? '(updating...)' : ''}</h2>
      <div className="divider"></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
        <div style={{ position: 'relative' }}>
          <img
            src={imageDataUrl}
            alt="Uploaded"
            style={{
              maxWidth: '100%',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          />
        </div>
        <div>
          <div className="feature">
            <h3>{verdict}</h3>
            <p>Confidence: {confidencePct}%</p>
          </div>
          <div className="feature" style={{ marginTop: '10px' }}>
            <h3>Recommendations</h3>
            <ul style={{ marginTop: '6px', paddingLeft: '18px' }}>
              {recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
          <div className="feature" style={{ marginTop: '10px' }}>
            <h3>Consult specialists nearby</h3>
            {doctorError && <div className="error" style={{ marginTop: '6px' }}>{doctorError}</div>}
            {!doctorError && doctors.length === 0 && (
              <div className="help" style={{ marginTop: '6px' }}>No nearby doctors available.</div>
            )}
            <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
              {doctors.map((doc, idx) => (
                <div key={idx} className="feature">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <strong>{doc.name}</strong>
                      <div className="help">{doc.title} · {doc.org}</div>
                      {doc.distance_km !== undefined && (
                        <div className="help">{doc.distance_km.toFixed(1)} km away</div>
                      )}
                    </div>
                    <div>
                      <a className="btn" href={`mailto:${doc.email}`}>Email</a>
                      <a className="btn ghost" href={`tel:${doc.phone}`}>Call</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="divider"></div>
          <button
            className="btn"
            onClick={() => {
              sessionStorage.removeItem('gc_last_result')
              navigate('/')
            }}
          >
            Analyze another image
          </button>
        </div>
      </div>
    </section>
  )
}

export default Result

