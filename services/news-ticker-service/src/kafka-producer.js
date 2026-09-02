const kafka = require('kafka-node')

class KafkaProducer {
  constructor(bootstrapServers) {
    this.producer = new kafka.KafkaProducer(
      new kafka.Client(bootstrapServers),
      new kafka.HighLevelProducer()
    )
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
