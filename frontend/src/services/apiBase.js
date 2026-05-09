/**
 * Backend origin for API calls and static files under /uploads (no trailing slash).
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/+$/, '')
  }
  if (import.meta.env.PROD) {
    return 'https://gastric-backend.onrender.com'
  }
  return 'http://localhost:8000'
}

/**
 * Turn a stored path like "/uploads/foo.jpg" into a full URL for <img> and PDF embedding.
 */
export function resolveUploadUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null
  const trimmed = imagePath.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = getApiBaseUrl()
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${path}`
}
