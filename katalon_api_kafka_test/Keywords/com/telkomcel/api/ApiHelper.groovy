package com.telkomcel.api

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.testobject.RequestObject
import com.kms.katalon.core.testobject.ResponseObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.util.KeywordUtil
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

public class ApiHelper {

    /**
     * Parse JSON response string into Groovy Map or List
     */
    @Keyword
    public static Object parseJsonResponse(ResponseObject response) {
        String responseText = response.getResponseText()
        KeywordUtil.logInfo("Parsing JSON Response:\n" + responseText)
        JsonSlurper slurper = new JsonSlurper()
        return slurper.parseText(responseText)
    }

    /**
     * Validate that response contains expected fields and values
     */
    @Keyword
    public static boolean verifyFieldEquals(Object jsonObject, String fieldName, Object expectedValue) {
        Object actualValue = jsonObject[fieldName]
        KeywordUtil.logInfo("Verifying field '${fieldName}'. Expected: ${expectedValue}, Actual: ${actualValue}")
        if (actualValue.toString() == expectedValue.toString()) {
            KeywordUtil.markPassed("Field '${fieldName}' matches expected value '${expectedValue}'")
            return true
        } else {
            KeywordUtil.markFailed("Field '${fieldName}' mismatch! Expected: '${expectedValue}', but got: '${actualValue}'")
            return false
        }
    }

    /**
     * Serialize a Map into JSON String for request payload
     */
    @Keyword
    public static String toJson(Map<String, Object> data) {
        return JsonOutput.toJson(data)
    }
}
