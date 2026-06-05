import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('ops_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ops_token');
      localStorage.removeItem('ops_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
