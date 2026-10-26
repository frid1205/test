import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.util.KeywordUtil
import internal.GlobalVariable as GlobalVariable
import groovy.json.JsonSlurper

/**
 * ============================================================================
 * TEST CASE: REST_API_Producer_Consumer_Test
 * 
 * OBJECTIVE:
 * 1. Katalon bertindak sebagai PRODUCER:
 *    - Mengirimkan request POST berisi data transaksi/order telekomunikasi baru.
 *    - Memvalidasi HTTP status code 201 (Created).
 *    - Mengekstrak data response (ID resource yang dibuat).
 * 
 * 2. Katalon bertindak sebagai CONSUMER:
 *    - Mengirimkan request GET untuk mengonsumsi/mengambil data dari REST API.
 *    - Memvalidasi HTTP status code 200 (OK).
 *    - Mengurai (parse) payload JSON.
 *    - Memverifikasi integritas data dan schema hasil response.
 * ============================================================================
 */

KeywordUtil.logInfo(">>> [PHASE 1] KATALON AS PRODUCER: Sending POST Request to create resource <<<")

// Setup test dataset for producer
String orderTitle = "Telkomcel Data Package Unlimited 50GB"
String orderDetails = "MSISDN: +670-77123456, Plan: 50GB, Price: USD 15.00, Status: COMPLETED"
int userId = 101

// 1. PRODUCER: Kirim request POST ke endpoint REST API
def postRequestObject = findTestObject('Object Repository/REST_API/POST_CreateOrder_Producer', [
    ('baseUrl') : GlobalVariable.BASE_URL,
    ('orderTitle') : orderTitle,
    ('orderDetails') : orderDetails,
    ('userId') : userId
])

def postResponse = WS.sendRequest(postRequestObject)

// Validasi respon Producer (HTTP Status 201 Created)
WS.verifyResponseStatusCode(postResponse, 201)
KeywordUtil.markPassed("Producer POST Request Succeeded with HTTP Status: " + postResponse.getStatusCode())

// Parse JSON response dari Producer
JsonSlurper slurper = new JsonSlurper()
def postResponseBody = slurper.parseText(postResponse.getResponseText())
KeywordUtil.logInfo("Producer Created Resource Payload: " + postResponse.getResponseText())

// Verifikasi atribut yang di-produce
assert postResponseBody.title == orderTitle : "Mismatch on title produced!"
assert postResponseBody.userId == userId : "Mismatch on userId produced!"
assert postResponseBody.id != null : "Generated Resource ID should not be null!"

int generatedId = postResponseBody.id
KeywordUtil.markPassed("Resource successfully produced with ID: " + generatedId)


KeywordUtil.logInfo(">>> [PHASE 2] KATALON AS CONSUMER: Sending GET Request to fetch resource <<<")

// 2. CONSUMER: Kirim request GET untuk membaca/mengonsumsi data dari endpoint REST API
// Catatan: jsonplaceholder adalah public mock server, GET id 1 merepresentasikan resource yang tersedia
int fetchId = 1
def getRequestObject = findTestObject('Object Repository/REST_API/GET_OrderById_Consumer', [
    ('baseUrl') : GlobalVariable.BASE_URL,
    ('orderId') : fetchId
])

def getResponse = WS.sendRequest(getRequestObject)

// Validasi respon Consumer (HTTP Status 200 OK)
WS.verifyResponseStatusCode(getResponse, 200)
KeywordUtil.markPassed("Consumer GET Request Succeeded with HTTP Status: " + getResponse.getStatusCode())

// Validasi Consumer Schema & Body
def getResponseBody = slurper.parseText(getResponse.getResponseText())
KeywordUtil.logInfo("Consumer Consumed Payload: " + getResponse.getResponseText())

// Assertions oleh Consumer
assert getResponseBody.id == fetchId : "Consumed ID does not match requested ID!"
assert getResponseBody.title != null && !getResponseBody.title.isEmpty() : "Consumed title should not be empty!"
assert getResponseBody.body != null : "Consumed body should not be null!"
assert getResponseBody.userId != null : "Consumed userId should not be null!"

// Validasi format Header Consumer
WS.verifyElementPropertyValue(getResponse, 'id', fetchId)
KeywordUtil.markPassed("RESTful API Test Completed Successfully: Katalon verified as both Producer and Consumer!")
