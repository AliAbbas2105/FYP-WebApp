import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import api from '../services/api'

function Result() {
  const [data, setData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [doctorError, setDoctorError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const raw = sessionStorage.getItem('gc_last_result')
    if (!raw) return

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

  // Refresh latest result (ensures we show updated backend predictions)
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

  // Fetch nearby doctors
  useEffect(() => {
    const normalizeUrl = (value) => {
      if (!value || typeof value !== 'string') return null
      const trimmed = value.trim()
      if (!trimmed) return null
      if (/^https?:\/\//i.test(trimmed)) return trimmed
      return `https://${trimmed}`
    }

    const mapGeoapifyDoctor = (feature) => {
      const props = feature.properties || {}
      const raw = props.datasource?.raw || {}
      const name = props.name || raw.name || 'Doctor'
      const title = raw.speciality || raw.specialty || raw.healthcare || 'Specialist'
      const org = raw.hospital || raw.operator || raw.brand || props.address_line2 || 'Nearby clinic'
      const distanceMeters = typeof props.distance === 'number' ? props.distance : null
      const distance_km = distanceMeters !== null ? distanceMeters / 1000 : undefined
      const website = normalizeUrl(raw.website || raw.url || null)
      const lat = typeof props.lat === 'number' ? props.lat : null
      const lng = typeof props.lon === 'number' ? props.lon : null
      const searchQuery = props.formatted || (lat !== null && lng !== null ? `${lat},${lng}` : '')
      const mapsUrl =
        searchQuery
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`
          : null
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} ${org}`)}`
      return { name, title, org, distance_km, website, mapsUrl, googleSearchUrl }
    }

    const fetchDoctorsFromGeoapify = async (lat, lng, apiKey) => {
      const url = new URL('https://api.geoapify.com/v2/places')
      url.searchParams.set(
        'categories',
        [
          'healthcare.clinic_or_praxis.gastroenterology',
          'healthcare.clinic_or_praxis.general',
          'healthcare.hospital',
          'healthcare'
        ].join(',')
      )
      url.searchParams.set('filter', `circle:${lng},${lat},50000`)
      url.searchParams.set('bias', `proximity:${lng},${lat}`)
      url.searchParams.set('limit', '30')
      url.searchParams.set('apiKey', apiKey)

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Doctor API failed (${res.status})`)

      const payload = await res.json()
      const mapped = (payload.features || []).map(mapGeoapifyDoctor)
      return mapped
        .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
        .slice(0, 5)
    }

    const fetchDoctors = async (lat, lng) => {
      const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY

      if (geoapifyKey) {
        try {
          const realDoctors = await fetchDoctorsFromGeoapify(lat, lng, geoapifyKey)
          setDoctors(realDoctors)
          setDoctorError('')
          return
        } catch {
          // If external lookup fails, still provide backend list instead of empty UI.
        }
      }

      try {
        const res = await api.get('/auth/doctors/nearby', {
          params: {
            lat,
            lng,
            radius_km: 50,
            limit: 20,
          },
        })
        setDoctors(res.data || [])
        setDoctorError(
          geoapifyKey
            ? 'Live doctor API is unavailable right now, showing backend doctors.'
            : 'Using backend doctors. Add VITE_GEOAPIFY_API_KEY for live nearby doctors.'
        )
      } catch (err) {
        setDoctorError(err.response?.data?.detail || 'Unable to load nearby doctors')
        setDoctors([])
      }
    }

    if (!navigator.geolocation) {
      setDoctorError('Location is not supported in this browser.')
      setDoctors([])
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        fetchDoctors(latitude, longitude)
      },
      () => {
        setDoctorError('Please allow location permission to fetch nearby doctors.')
        setDoctors([])
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
        'Plan follow-up or further diagnostics as advised.'
      ]
    }
    if (confidence >= 0.5) {
      return [
        `Moderate confidence (${pct}%). Consider additional review or imaging if available.`,
        'Discuss the finding with a clinician to decide next actions.',
        'Ensure image quality is adequate before conclusions.'
      ]
    }
    return [
      `Low confidence (${pct}%). Acquire clearer imagery or additional views if possible.`,
      'Re-run analysis after quality check; consult a clinician if concerns persist.',
      'Use results as supportive info, not a diagnosis.'
    ]
  }

  const recommendations = buildRecommendations(inference.confidence)
  const verdict = `Predicted class: ${inference.label}`

  const formatDateTime = (value) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value)
  }

  const imageToDataUrl = (source) =>
    new Promise((resolve, reject) => {
      if (!source) {
        reject(new Error('No image source'))
        return
      }

      if (source.startsWith('data:image')) {
        resolve(source)
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas context unavailable')
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = source
    })

  const handleDownloadReport = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const createdAt = new Date()
    const confidenceText = `${confidencePct}%`
    const reportId = `GC-${data.imageId || 'LOCAL'}`

    doc.setFillColor(22, 72, 99)
    doc.rect(0, 0, 210, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Gastric Cancer AI Lab Report', 14, 15)

    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Report ID: ${reportId}`, 14, 32)
    doc.text(`Generated: ${formatDateTime(createdAt)}`, 14, 37)

    doc.setDrawColor(180, 180, 180)
    doc.rect(14, 42, 86, 86)
    doc.setFont('helvetica', 'bold')
    doc.text('Submitted Image', 18, 49)

    try {
      const reportImage = await imageToDataUrl(imageDataUrl)
      doc.addImage(reportImage, 'JPEG', 18, 53, 78, 70)
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Image preview unavailable', 20, 88)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Inference Summary', 108, 49)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Predicted class: ${inference.label}`, 108, 58)
    doc.text(`Confidence score: ${confidenceText}`, 108, 64)
    doc.text(
      'Note: This AI output is supportive information and not a definitive diagnosis.',
      108,
      72,
      { maxWidth: 88 }
    )

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Recommendations', 14, 140)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    recommendations.forEach((rec, idx) => {
      doc.text(`- ${rec}`, 14, 148 + idx * 8, { maxWidth: 182 })
    })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Nearby Specialists', 14, 179)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const topDoctors = doctors.slice(0, 3)
    if (topDoctors.length === 0) {
      doc.text('No specialist entries available at generation time.', 14, 187)
    } else {
      topDoctors.forEach((docItem, idx) => {
        const y = 187 + idx * 11
        const distance =
          docItem.distance_km !== undefined ? ` (${docItem.distance_km.toFixed(1)} km)` : ''
        doc.text(`${idx + 1}. ${docItem.name}${distance}`, 14, y)
        doc.text(
          `${docItem.title || 'Specialist'} | ${docItem.org || 'Independent'} | ${docItem.phone || 'N/A'}`,
          18,
          y + 5,
          { maxWidth: 178 }
        )
      })
    }

    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text('Generated by Gastric Cancer AI frontend report template v1.0', 14, 286)

    doc.save(`lab_report_${reportId}.pdf`)
  }

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
              {doctors.slice(0, 5).map((doc, idx) => (
                <div key={idx} className="feature">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <strong>{doc.name}</strong>
                      <div className="help">{doc.title} · {doc.org}</div>

                      {doc.distance_km !== undefined && (
                        <div className="help">{doc.distance_km.toFixed(1)} km away</div>
                      )}

                      <div className="help">Use Maps/Website for contact details.</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {doc.website ? (
                        <a className="btn ghost" href={doc.website} target="_blank" rel="noreferrer">
                          Website
                        </a>
                      ) : (
                        <a className="btn ghost" href={doc.googleSearchUrl} target="_blank" rel="noreferrer">
                          Search on Google
                        </a>
                      )}

                      {doc.mapsUrl ? (
                        <a className="btn ghost" href={doc.mapsUrl} target="_blank" rel="noreferrer">
                          Open in Maps
                        </a>
                      ) : (
                        <button className="btn ghost disabled" disabled>Open in Maps</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider"></div>

          <button className="btn ghost" onClick={handleDownloadReport} style={{ marginBottom: '10px' }}>
            Download lab report (PDF)
          </button>

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
