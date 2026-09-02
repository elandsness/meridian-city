const express = require('express')
const cron = require('node-cron')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8096

// In-memory weather data (simulated)
const WEATHER_DATA = {
  temperature: 72,
  humidity: 65,
  condition: 'Partly Cloudy',
  wind_speed: 12,
  forecast: [
    { day: 'Monday', high: 75, low: 65, condition: 'Sunny' },
    { day: 'Tuesday', high: 70, low: 60, condition: 'Cloudy' },
    { day: 'Wednesday', high: 68, low: 58, condition: 'Rain' },
  ],
}

app.get('/api/v1/weather', (req, res) => {
  res.json(WEATHER_DATA)
})

app.get('/api/v1/weather/forecast', (req, res) => {
  res.json(WEATHER_DATA.forecast)
})

// Simulate weather updates every 5 minutes
cron.schedule('*/5 * * * *', () => {
  WEATHER_DATA.temperature = 65 + Math.floor(Math.random() * 25)
  WEATHER_DATA.humidity = 40 + Math.floor(Math.random() * 50)
  WEATHER_DATA.condition = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rain'][Math.floor(Math.random() * 4)]
  WEATHER_DATA.wind_speed = 5 + Math.floor(Math.random() * 20)
  console.log('Weather data updated')
})

app.listen(PORT, () => {
  console.log(`Weather service listening on port ${PORT}`)
})
