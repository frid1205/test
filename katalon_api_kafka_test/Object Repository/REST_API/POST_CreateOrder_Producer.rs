<?xml version="1.0" encoding="UTF-8"?>
<WebServiceRequestEntity>
   <description>Katalon acting as RESTful API PRODUCER: Sends POST request to create an order resource</description>
   <name>POST_CreateOrder_Producer</name>
   <tag></tag>
   <elementGuidId>4f4f5a9e-873b-410a-8bf3-5c743813ef01</elementGuidId>
   <selectorMethod>BASIC</selectorMethod>
   <useRalativeImagePath>false</useRalativeImagePath>
   <autoUpdateUrl>true</autoUpdateUrl>
   <connectionTimeout>10000</connectionTimeout>
   <followRedirects>false</followRedirects>
   <httpBody>{
  "title": "${orderTitle}",
  "body": "${orderDetails}",
  "userId": ${userId}
}</httpBody>
   <httpBodyContent>{
  "text": "{\n  \"title\": \"${orderTitle}\",\n  \"body\": \"${orderDetails}\",\n  \"userId\": ${userId}\n}",
  "contentType": "application/json",
  "charset": "UTF-8"
}</httpBodyContent>
   <httpBodyType>text</httpBodyType>
   <httpHeaderProperties>
      <isSelected>true</isSelected>
      <matchCondition>EQUALS</matchCondition>
      <name>Content-Type</name>
      <type>Main</type>
      <value>application/json</value>
   </httpHeaderProperties>
   <katalonVersion>9.3.0</katalonVersion>
   <maxResponseSize>0</maxResponseSize>
   <migratedVersion>5.4.1</migratedVersion>
   <restRequestMethod>POST</restRequestMethod>
   <restUrl>${baseUrl}/posts</restUrl>
   <serviceType>RESTful</serviceType>
   <soapBody></soapBody>
   <soapHeader></soapHeader>
   <soapRequestMethod></soapRequestMethod>
   <soapServiceEndpoint></soapServiceEndpoint>
   <soapServiceFunction></soapServiceFunction>
   <socketTimeout>10000</socketTimeout>
   <useServiceInfoFromWsdl>true</useServiceInfoFromWsdl>
   <variables>
      <defaultValue>GlobalVariable.BASE_URL</defaultValue>
      <description></description>
      <id>1b2a3c4d-0001</id>
      <masked>false</masked>
      <name>baseUrl</name>
   </variables>
   <variables>
      <defaultValue>'Data Package - Telkomcel Unlimited 50GB'</defaultValue>
      <description></description>
      <id>1b2a3c4d-0002</id>
      <masked>false</masked>
      <name>orderTitle</name>
   </variables>
   <variables>
      <defaultValue>'MSISDN: +670-77123456, Price: $15, Status: IN_PROGRESS'</defaultValue>
      <description></description>
      <id>1b2a3c4d-0003</id>
      <masked>false</masked>
      <name>orderDetails</name>
   </variables>
   <variables>
      <defaultValue>1</defaultValue>
      <description></description>
      <id>1b2a3c4d-0004</id>
      <masked>false</masked>
      <name>userId</name>
   </variables>
   <verificationScript>import static org.assertj.core.api.Assertions.*

import com.kms.katalon.core.testobject.RequestObject
import com.kms.katalon.core.testobject.ResponseObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.webservice.verification.WSResponseManager

ResponseObject response = WSResponseManager.getInstance().getCurrentResponse()
WS.verifyResponseStatusCode(response, 201)
assertThat(response.getStatusCode()).isEqualTo(201)
</verificationScript>
   <wsdlAddress></wsdlAddress>
</WebServiceRequestEntity>
