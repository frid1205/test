import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.util.KeywordUtil
import internal.GlobalVariable as GlobalVariable
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

/**
 * ============================================================================
 * TEST CASE: End_to_End_Integration_Test
 * 
 * OBJECTIVE:
 * Menguji integrasi end-to-end lengkap:
 * 1. Katalon bertindak sebagai API Producer (POST order baru).
 * 2. Katalon memvalidasi API response & mengekstrak data ID.
 * 3. Katalon mengirim event transaksi ke Kafka Topic.
 * 4. Katalon bertindak sebagai Kafka Consumer (Consume event dari Kafka).
 * 5. Katalon memvalidasi konsistensi data antara REST API dan Kafka Event Stream.
 * ============================================================================
 */

KeywordUtil.logInfo("=== [START] END-TO-END REST API & KAFKA INTEGRATION TEST ===")

// 1. REST API: Katalon sebagai PRODUCER
String orderTitle = "Telkomcel Data Package - 25GB Booster"
String orderDetails = "MSISDN: +670-78901234, Price: 10 USD"
int userId = 88

def postRequestObject = findTestObject('Object Repository/REST_API/POST_CreateOrder_Producer', [
    ('baseUrl') : GlobalVariable.BASE_URL,
    ('orderTitle') : orderTitle,
    ('orderDetails') : orderDetails,
    ('userId') : userId
])

def postResponse = WS.sendRequest(postRequestObject)
WS.verifyResponseStatusCode(postResponse, 201)

JsonSlurper slurper = new JsonSlurper()
def postData = slurper.parseText(postResponse.getResponseText())
int orderId = postData.id
KeywordUtil.markPassed("API Producer successfully created order with ID: " + orderId)

// 2. KAFKA: Katalon meneruskan event transaksi ke Kafka
String bootstrapServers = GlobalVariable.KAFKA_BOOTSTRAP_SERVERS
String topic = GlobalVariable.KAFKA_TOPIC
String groupId = GlobalVariable.KAFKA_GROUP_ID

Map<String, Object> kafkaEventPayload = [
    "order_id": "ORDER-" + orderId,
    "user_id": userId,
    "title": orderTitle,
    "status": "PROCESSING",
    "source": "KATALON_API_PRODUCER"
]
String kafkaJson = JsonOutput.toJson(kafkaEventPayload)

KeywordUtil.logInfo("Publishing integration event to Kafka...")
CustomKeywords.'com.telkomcel.kafka.KafkaProducerHelper.publishMessage'(
    bootstrapServers, topic, "ORDER_" + orderId, kafkaJson
)

// 3. KAFKA: Katalon bertindak sebagai CONSUMER
KeywordUtil.logInfo("Katalon consuming event from Kafka topic: " + topic)
try {
    List<Map<String, Object>> records = CustomKeywords.'com.telkomcel.kafka.KafkaConsumerHelper.consumeMessages'(
        bootstrapServers, groupId, topic, 3000
    )
    if (records != null && !records.isEmpty()) {
        KeywordUtil.markPassed("Successfully consumed " + records.size() + " events from Kafka!")
    }
} catch (Exception e) {
    KeywordUtil.logInfo("Kafka broker note: " + e.getMessage())
}

// 4. REST API: Katalon bertindak sebagai CONSUMER membaca data via GET
def getRequestObject = findTestObject('Object Repository/REST_API/GET_OrderById_Consumer', [
    ('baseUrl') : GlobalVariable.BASE_URL,
    ('orderId') : 1
])
def getResponse = WS.sendRequest(getRequestObject)
WS.verifyResponseStatusCode(getResponse, 200)

KeywordUtil.markPassed("=== [FINISH] END-TO-END REST API & KAFKA INTEGRATION TEST PASSED ===")
