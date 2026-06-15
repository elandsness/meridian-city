import axios from 'axios'
import { reportError } from '../lib/rum.js'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('meridian_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      localStorage.removeItem('meridian_token')
      localStorage.removeItem('meridian_user')
      window.location.href = '/login'
    } else if (status >= 500) {
      reportError(error)
    }
    return Promise.reject(error)
  }
)

export default client
