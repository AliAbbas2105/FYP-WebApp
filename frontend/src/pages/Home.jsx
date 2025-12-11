import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function Home() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    drawSpark()
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setPreview(null)
      return
    }

    // Validate file type (only PNG, JPG, JPEG)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    const allowedExtensions = ['.png', '.jpg', '.jpeg']
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setError('Please upload only PNG, JPG, or JPEG images.')
      setSelectedFile(null)
      setPreview(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setSelectedFile(file)
    setError('')

    // Create preview
    const url = URL.createObjectURL(file)
    setPreview(url)

    // Cleanup on unmount
    return () => URL.revokeObjectURL(url)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select an image')
      return
    }

    // Double-check file type validation
    const allowedExtensions = ['.png', '.jpg', '.jpeg']
    const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      setError('Please upload only PNG, JPG, or JPEG images.')
      return
    }

    setIsAnalyzing(true)
    setError('')

    try {
      // Upload image
      const formData = new FormData()
      formData.append('file', selectedFile)

      const uploadResponse = await api.post('/image/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const imageId = uploadResponse.data.image_id

      // Run prediction
      const predictResponse = await api.post(`/image/predict/${imageId}`)
      
      // Parse result
      let result
      try {
        result = JSON.parse(predictResponse.data.result)
      } catch {
        // If backend returns a simple string, surface it without faking defaults
        const resultStr = predictResponse.data.result
        if (!resultStr) {
          throw new Error('Prediction result missing')
        }
        const [label, confidence] = resultStr.split(':')
        result = {
          label: label || resultStr,
          confidence: confidence ? parseFloat(confidence) : null
        }
      }
      
      // Get image URL from backend or use preview
      const imageUrl = predictResponse.data.image_path 
        ? `http://localhost:8000${predictResponse.data.image_path}`
        : (preview || await toDataUrl(selectedFile))

      // Store in session for result page
      sessionStorage.setItem('gc_last_result', JSON.stringify({
        imageDataUrl: imageUrl,
        inference: result,
        imageId
      }))

      navigate('/result')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to analyze image. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const drawSpark = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    const cssW = 520
    const cssH = 280
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const w = cssW
    const h = cssH

    // Grid background
    function drawGrid() {
      ctx.save()
      ctx.clearRect(0, 0, w, h)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, 'rgba(255,255,255,0.03)')
      bgGrad.addColorStop(1, 'rgba(0,0,0,0.10)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      const rows = 5
      const cols = 10
      for (let i = 1; i < rows; i++) {
        const y = (i / rows) * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      for (let i = 1; i < cols; i++) {
        const x = (i / cols) * w
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Deterministic pseudo-random
    function prng(seed) {
      let s = seed >>> 0
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0
        return (s & 0xffff) / 0xffff
      }
    }
    const rand = prng(42)

    // Generate two synthetic series
    const steps = 80
    const loss = []
    const auc = []
    let l = 1.0
    let a = 0.55
    for (let i = 0; i < steps; i++) {
      l -= (0.9 - 0.1 * rand()) / steps
      a += (0.95 - a) * 0.08 + (rand() - 0.5) * 0.01
      loss.push(Math.max(0.08, Math.min(1, l + (rand() - 0.5) * 0.02)))
      auc.push(Math.max(0.5, Math.min(0.98, a + (rand() - 0.5) * 0.01)))
    }

    const pad = { l: 36, r: 12, t: 16, b: 26 }
    const xAt = (i) => pad.l + (i / (steps - 1)) * (w - pad.l - pad.r)
    const yLoss = (v) => pad.t + (1 - (v - 0) / (1.0 - 0)) * (h - pad.t - pad.b)
    const yAuc = (v) => pad.t + (1 - (v - 0.5) / (1.0 - 0.5)) * (h - pad.t - pad.b)

    let t = 0
    const duration = 750
    let start = null

    function draw() {
      drawGrid()
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '12px Inter, system-ui, sans-serif'
      ctx.fillText('Loss', pad.l, pad.t - 4)
      ctx.fillText('AUC', w - 60, pad.t - 4)
      ctx.restore()

      const count = Math.max(2, Math.floor(steps * t))

      // Draw LOSS
      const gradLoss = ctx.createLinearGradient(0, pad.t, 0, h - pad.b)
      gradLoss.addColorStop(0, 'rgba(255,107,107,0.35)')
      gradLoss.addColorStop(1, 'rgba(255,107,107,0.05)')

      ctx.beginPath()
      for (let i = 0; i < count; i++) {
        const x = xAt(i)
        const y = yLoss(loss[i])
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(255,107,107,0.9)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.lineTo(xAt(count - 1), h - pad.b)
      ctx.lineTo(xAt(0), h - pad.b)
      ctx.closePath()
      ctx.fillStyle = gradLoss
      ctx.fill()

      // Draw AUC
      const gradAuc = ctx.createLinearGradient(0, 0, w, 0)
      gradAuc.addColorStop(0, 'rgba(91,208,255,1)')
      gradAuc.addColorStop(1, 'rgba(124,245,161,1)')
      ctx.beginPath()
      for (let i = 0; i < count; i++) {
        const x = xAt(i)
        const y = yAuc(auc[i])
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = gradAuc
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 6
      ctx.stroke()
      ctx.shadowBlur = 0

      const lastX = xAt(count - 1)
      const lastY = yAuc(auc[count - 1])
      ctx.fillStyle = 'rgba(124,245,161,1)'
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '12px Inter, system-ui, sans-serif'
      ctx.fillText('Synthetic metrics (demo)', pad.l, h - 6)
      ctx.restore()
    }

    function step(ts) {
      if (start === null) start = ts
      const elapsed = ts - start
      t = Math.min(1, elapsed / duration)
      draw()
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Federated Learning · Privacy-Preserving AI</div>
          <h1>Federated Intelligence for Gastric Cancer Detection</h1>
          <p className="lede">Accurate. Secure. Federated. Revolutionizing gastric cancer diagnosis through privacy-preserving AI.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button 
              className="btn primary" 
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Image
            </button>
            <button 
              className="btn ghost" 
              onClick={() => window.alert('Your image is sent to the backend model for inference. Data is kept to your account history only.')}
            >
              How this works
            </button>
          </div>
        </div>
        <div className="card">
          <canvas 
            ref={canvasRef}
            width="520" 
            height="280" 
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '12px',
              background: 'radial-gradient(600px 300px at 20% 10%, rgba(91,208,255,0.15), transparent), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2))'
            }}
          />
          <div className="help" style={{ marginTop: '10px' }}>Synthetic metric preview</div>
        </div>
      </section>

      <section className="card" id="upload-section">
        <h2>Run an analysis</h2>
        <p className="help">Select an endoscopy image (JPG/PNG). The image is sent to the backend model for inference, and the prediction is returned to you.</p>
        <div className="divider"></div>
        <form id="inference-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="img-input">Image</label>
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <input
                ref={fileInputRef}
                id="img-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                required
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 2
                }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  pointerEvents: 'none',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {selectedFile ? selectedFile.name : 'Choose Image (PNG, JPG, JPEG only)'}
              </button>
            </div>
            {error && <div className="error" style={{ marginTop: '8px' }}>{error}</div>}
            {!error && <div className="help" style={{ marginTop: '6px' }}>Accepted formats: PNG, JPG, JPEG</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start', marginTop: '14px' }}>
            <div>
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                />
              )}
            </div>
            <div>
              <button 
                className="btn primary" 
                type="submit" 
                disabled={isAnalyzing || !selectedFile}
              >
                {isAnalyzing ? 'Running analysis…' : 'Run analysis'}
              </button>
              <div style={{ marginTop: '12px' }}>
                <div className="help">Results appear after you run analysis.</div>
              </div>
            </div>
          </div>
        </form>
      </section>
    </>
  )
}

export default Home
