package com.telkomcel.kafka

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.util.KeywordUtil
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecords
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.common.serialization.StringDeserializer
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.time.Duration
import java.util.Properties

public class KafkaConsumerHelper {

    /**
     * Initializes and returns a KafkaConsumer instance
     */
    @Keyword
    public static KafkaConsumer<String, String> initConsumer(String bootstrapServers, String groupId) {
        Properties props = new Properties()
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers)
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId)
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName())
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName())
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest")
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true")
        props.put(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, "1000")
        props.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, "30000")

        KeywordUtil.logInfo("Initializing Kafka Consumer with bootstrap: " + bootstrapServers + ", Group ID: " + groupId)
        return new KafkaConsumer<String, String>(props)
    }

    /**
     * Katalon acts as Consumer: Subscribes to topic and consumes messages within a timeout
     */
    @Keyword
    public static List<Map<String, Object>> consumeMessages(String bootstrapServers, String groupId, String topic, int timeoutMs) {
        KafkaConsumer<String, String> consumer = null
        List<Map<String, Object>> consumedRecords = new ArrayList<>()

        try {
            consumer = initConsumer(bootstrapServers, groupId)
            consumer.subscribe(Collections.singletonList(topic))
            KeywordUtil.logInfo("Subscribed to topic: " + topic + ". Polling for messages (timeout: " + timeoutMs + " ms)...")

            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(timeoutMs))
            KeywordUtil.logInfo("Total records polled from topic [" + topic + "]: " + records.count())

            for (ConsumerRecord<String, String> record : records) {
                Map<String, Object> recordData = new HashMap<>()
                recordData.put("topic", record.topic())
                recordData.put("partition", record.partition())
                recordData.put("offset", record.offset())
                recordData.put("key", record.key())
                recordData.put("value", record.value())
                recordData.put("timestamp", record.timestamp())
                consumedRecords.add(recordData)

                KeywordUtil.logInfo(String.format("Consumed Record -> Partition: %d, Offset: %d, Key: %s, Value: %s",
                        record.partition(), record.offset(), record.key(), record.value()))
            }
        } catch (Exception e) {
            KeywordUtil.markWarning("Error while consuming Kafka messages: " + e.getMessage())
            throw e
        } finally {
            if (consumer != null) {
                consumer.close()
                KeywordUtil.logInfo("Kafka Consumer closed gracefully.")
            }
        }

        return consumedRecords
    }

    /**
     * Validates that the consumed JSON payload matches expected field assertions
     */
    @Keyword
    public static boolean verifyKafkaMessagePayload(String messageJson, Map<String, Object> expectedKeyValues) {
        KeywordUtil.logInfo("Verifying Kafka Message Payload: " + messageJson)
        JsonSlurper slurper = new JsonSlurper()
        Map<String, Object> actualMap = (Map<String, Object>) slurper.parseText(messageJson)

        boolean allMatched = true
        for (Map.Entry<String, Object> entry : expectedKeyValues.entrySet()) {
            String key = entry.getKey()
            Object expected = entry.getValue()
            Object actual = actualMap.get(key)

            if (actual != null && actual.toString() == expected.toString()) {
                KeywordUtil.markPassed("Field [" + key + "] verified. Value: " + actual)
            } else {
                KeywordUtil.markFailed("Field [" + key + "] verification failed! Expected: " + expected + ", Actual: " + actual)
                allMatched = false
            }
        }
        return allMatched
    }
}
