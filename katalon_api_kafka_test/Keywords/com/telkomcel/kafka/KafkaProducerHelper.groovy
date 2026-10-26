package com.telkomcel.kafka

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.util.KeywordUtil
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.clients.producer.RecordMetadata
import org.apache.kafka.common.serialization.StringSerializer
import java.util.Properties
import java.util.concurrent.Future

public class KafkaProducerHelper {

    /**
     * Helper to publish a test message to Kafka topic to simulate external producer
     */
    @Keyword
    public static boolean publishMessage(String bootstrapServers, String topic, String key, String jsonValue) {
        Properties props = new Properties()
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers)
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName())
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName())
        props.put(ProducerConfig.ACKS_CONFIG, "all")
        props.put(ProducerConfig.RETRIES_CONFIG, 3)

        KafkaProducer<String, String> producer = null
        try {
            producer = new KafkaProducer<String, String>(props)
            ProducerRecord<String, String> record = new ProducerRecord<>(topic, key, jsonValue)
            KeywordUtil.logInfo("Publishing test message to topic [" + topic + "] with key [" + key + "]...")

            Future<RecordMetadata> future = producer.send(record)
            RecordMetadata metadata = future.get()
            KeywordUtil.logInfo("Message published successfully to topic: " + metadata.topic() +
                    ", partition: " + metadata.partition() + ", offset: " + metadata.offset())
            return true
        } catch (Exception e) {
            KeywordUtil.markWarning("Failed to publish message to Kafka: " + e.getMessage())
            return false
        } finally {
            if (producer != null) {
                producer.flush()
                producer.close()
            }
        }
    }
}
