import axios from 'axios'

// Vercel: set VITE_API_BASE_URL (preferred). In production builds, missing env falls back to deployed API.
function apiBaseURL() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv) return fromEnv
  if (import.meta.env.PROD) return 'https://gastric-backend.onrender.com'
  return 'http://localhost:8000'
}

const api = axios.create({
  baseURL: apiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api

