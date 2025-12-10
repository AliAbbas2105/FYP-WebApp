import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Result() {
  const [data, setData] = useState(null)
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
  const isCancerous = inference.label === 'cancerous'
  const confidencePct = Math.round(inference.confidence * 100)

  const buildRecommendations = (isCancerous, confidence) => {
    const pct = Math.round(confidence * 100)
    if (isCancerous) {
      if (confidence >= 0.95) {
        return [
          `Urgent referral to gastroenterology for confirmatory endoscopy/biopsy (confidence ${pct}%).`,
          'Document clinical symptoms and risk factors to aid triage.',
          'Do not rely solely on AI; confirm with clinical evaluation.'
        ]
      }
      return [
        `Refer to gastroenterology for diagnostic confirmation (confidence ${pct}%).`,
        'Consider additional imaging views if available to improve assessment.',
        'Discuss findings with the patient and plan timely follow-up.'
      ]
    }
    if (confidence >= 0.95) {
      return [
        `No immediate red flags detected (confidence ${pct}%).`,
        'Continue routine screening per local guidelines.',
        'Consult a clinician if symptoms persist or worsen.'
      ]
    }
    return [
      `Low likelihood detected (confidence ${pct}%).`,
      'If image quality is suboptimal, consider re-imaging for clarity.',
      'Monitor symptoms; seek medical advice if concerns arise.'
    ]
  }

  const getDummyDoctors = () => {
    return [
      { name: 'Dr. Aisha Rahman', title: 'Gastroenterologist', org: 'City Medical Center', email: 'a.rahman@example.org', phone: '+1-555-201-1100' },
      { name: 'Dr. Kenji Nakamura', title: 'GI Oncologist', org: 'Regional Cancer Institute', email: 'k.nakamura@example.org', phone: '+1-555-201-2233' },
      { name: 'Dr. Maria Gomez', title: 'Endoscopy Specialist', org: 'St. Mary Hospital', email: 'm.gomez@example.org', phone: '+1-555-201-3344' }
    ]
  }

  const recommendations = buildRecommendations(isCancerous, inference.confidence)
  const doctors = getDummyDoctors()
  const verdict = isCancerous ? 'Image is cancerous' : 'Image is non-cancerous'

  return (
    <section className="card">
      <h2>Result</h2>
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
          {isCancerous && inference.confidence >= 0.90 && (
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(255,0,0,0.85)',
              color: 'white',
              fontWeight: 600
            }}>
              Gastric cancer
            </div>
          )}
        </div>
        <div>
          <div className="feature">
            <h3>{verdict}</h3>
            <p>Assumed accuracy: {confidencePct}%</p>
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
            <h3>Consult specialists</h3>
            <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
              {doctors.map((doc, idx) => (
                <div key={idx} className="feature">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <strong>{doc.name}</strong>
                      <div className="help">{doc.title} · {doc.org}</div>
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
          <div className="help" style={{ marginTop: '8px' }}>
            This is a simulated result for UI demonstration only.
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

