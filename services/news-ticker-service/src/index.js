const express = require('express')
const { KafkaProducer } = require('./kafka-producer')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8095
const KAFKA_BOOTSTRAP_SERVERS = process.env.KAFKA_BOOTSTRAP_SERVERS || 'meridian-kafka-bootstrap:9092'

const producer = new KafkaProducer(KAFKA_BOOTSTRAP_SERVERS)

// In-memory news ticker data
const NEWS_ITEMS = [
  { id: '1', title: 'City Council Approves New Transit Plan', category: 'transportation', urgency: 'normal', published_at: new Date().toISOString() },
  { id: '2', title: 'Annual Festival Returns to Downtown', category: 'events', urgency: 'normal', published_at: new Date().toISOString() },
  { id: '3', title: 'Water Main Break on 5th Avenue', category: 'infrastructure', urgency: 'high', published_at: new Date().toISOString() },
  { id: '4', title: 'New Recycling Center Opens', category: 'sustainability', urgency: 'low', published_at: new Date().toISOString() },
  { id: '5', title: 'Traffic Alert: Road Closure on Highway 101', category: 'transportation', urgency: 'high', published_at: new Date().toISOString() },
]

app.get('/api/v1/news', (req, res) => {
  res.json(NEWS_ITEMS)
})

app.get('/api/v1/news/:id', (req, res) => {
  const item = NEWS_ITEMS.find(n => n.id === req.params.id)
  if (!item) {
    return res.status(404).json({ error: 'News item not found' })
  }
  res.json(item)
})

app.post('/api/v1/news', (req, res) => {
  const { title, category, urgency } = req.body
  if (!title || !category) {
    return res.status(400).json({ error: 'title and category are required' })
  }

  const newItem = {
    id: String(NEWS_ITEMS.length + 1),
    title,
    category,
    urgency: urgency || 'normal',
    published_at: new Date().toISOString(),
  }
  NEWS_ITEMS.push(newItem)

  producer.publish('news.events', {
    eventType: 'news.published',
    newsId: newItem.id,
    category: newItem.category,
    urgency: newItem.urgency,
    timestamp: new Date().toISOString(),
  })

  res.status(201).json(newItem)
})

app.listen(PORT, () => {
  console.log(`News ticker service listening on port ${PORT}`)
})
