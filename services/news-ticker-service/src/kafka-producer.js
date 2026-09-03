const kafka = require('kafka-node')

class KafkaProducer {
  constructor(bootstrapServers) {
    const client = new kafka.KafkaClient({ kafkaHost: bootstrapServers })
    this.producer = new kafka.HighLevelProducer(client)
  }

  publish(topic, message) {
    const payload = [{ topic, messages: [JSON.stringify(message)] }]
    this.producer.send(payload, (err, data) => {
      if (err) {
        console.error('Failed to publish to Kafka:', err)
      }
    })
  }
}

module.exports = { KafkaProducer }
