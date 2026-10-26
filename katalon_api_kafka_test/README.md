# Katalon Studio Automation: RESTful API (Producer & Consumer) & Apache Kafka (Consumer)

Project otomasi pengujian menggunakan **Katalon Studio** untuk memenuhi uji kemampuan teknis:
1. **Pengujian RESTful API**: Katalon berperan sebagai **Producer** (POST) dan **Consumer** (GET & Data Verification).
2. **Pengujian Apache Kafka**: Katalon berperan sebagai **Consumer** (Subscribe, Polling Stream Event, Deserialisasi JSON, dan Assertion Payload).

---

## 📁 Struktur Project Katalon

```text
katalon_api_kafka_test/
├── .classpath                              # Eclipse / Katalon classpath
├── .project                                # Project metadata
├── katalon_api_kafka_test.prj              # Katalon Studio project descriptor
├── build.gradle                            # Dependency manager (Kafka client, Jackson, SLF4J)
├── docker-compose.yml                      # Local Apache Kafka Broker (KRaft mode)
├── README.md                               # Dokumentasi teknis & panduan eksekusi
├── Data Files/
│   └── OrderData.csv                       # Dataset pengujian transaksi telekomunikasi
├── Drivers/
│   ├── kafka-clients-3.6.1.jar             # Driver Apache Kafka Client
│   └── slf4j-api-1.7.36.jar                # Driver Logging
├── Profiles/
│   └── default.glbl                        # Global variables (Base URL, Kafka Broker, Topic, Group ID)
├── Object Repository/
│   └── REST_API/
│       ├── POST_CreateOrder_Producer.rs    # Web Service Object: Katalon as Producer
│       └── GET_OrderById_Consumer.rs       # Web Service Object: Katalon as Consumer
├── Keywords/
│   └── com/telkomcel/
│       ├── api/
│       │   └── ApiHelper.groovy            # Helper JSON parser & assertions API
│       └── kafka/
│           ├── KafkaConsumerHelper.groovy  # Custom Keyword: Kafka Consumer & Payload Assertion
│           └── KafkaProducerHelper.groovy  # Custom Keyword: Helper simulation upstream producer
├── Scripts/
│   ├── REST_API_Producer_Consumer_Test/
│   │   └── Script.groovy                   # Test Script: Producer POST & Consumer GET
│   ├── Kafka_Consumer_Test/
│   │   └── Script.groovy                   # Test Script: Kafka Consumer Polling & Assertion
│   └── End_to_End_Integration_Test/
│       └── Script.groovy                   # Test Script: E2E Chained API -> Kafka -> Consumer
├── Test Cases/
│   ├── REST_API_Producer_Consumer_Test.tc  # Test Case Entity: REST API
│   ├── Kafka_Consumer_Test.tc              # Test Case Entity: Kafka Consumer
│   └── End_to_End_Integration_Test.tc      # Test Case Entity: End-to-End
└── Test Suites/
    └── Telecom_API_Kafka_TestSuite.ts      # Test Suite runner untuk seluruh test case
```

---

## 🚀 Skenario 1: Pengujian RESTful API (Producer & Consumer)

### A. Katalon sebagai PRODUCER (POST Request)
Katalon mengirimkan HTTP POST request membawa payload transaksi pemesanan paket data ke REST API server.
- **Endpoint**: `${GlobalVariable.BASE_URL}/posts`
- **Method**: `POST`
- **Request Body (JSON)**:
  ```json
  {
    "title": "Telkomcel Data Package Unlimited 50GB",
    "body": "MSISDN: +670-77123456, Plan: 50GB, Price: USD 15.00, Status: COMPLETED",
    "userId": 101
  }
  ```
- **Verifikasi Producer**:
  - Memverifikasi HTTP Response Status Code: `201 Created`.
  - Memastikan atribut `id` berhasil di-generate dan tersimpan dalam respons.

### B. Katalon sebagai CONSUMER (GET Request & Assertion)
Katalon bertindak sebagai consumer dengan mengambil resource data melalui HTTP GET, melakukan parsing format JSON, dan meng-assert integritas data.
- **Endpoint**: `${GlobalVariable.BASE_URL}/posts/{id}`
- **Method**: `GET`
- **Verifikasi Consumer**:
  - Memverifikasi HTTP Status Code: `200 OK`.
  - Mengurai respon JSON menggunakan `JsonSlurper`.
  - Asserting bahwa field `id`, `title`, `body`, dan `userId` konsisten dan tidak bernilai null.

---

## ⚡ Skenario 2: Pengujian Apache Kafka (Katalon sebagai Consumer)

### A. Mekanisme Kerja Kafka Consumer di Katalon
Katalon menggunakan library resmi `org.apache.kafka:kafka-clients` yang diimplementasikan melalui Custom Keyword `KafkaConsumerHelper.groovy`:
1. **Konfigurasi Consumer**:
   - `bootstrap.servers`: `localhost:9092` (didefinisikan pada Profile `default.glbl`)
   - `group.id`: `katalon-order-consumer-group`
   - `key.deserializer`: `StringDeserializer`
   - `value.deserializer`: `StringDeserializer`
   - `auto.offset.reset`: `earliest` (memastikan membaca seluruh log pesan dari awal offset)
2. **Subscription & Polling**:
   - Consumer melakukan subscribe ke topic `telecom.order.events`.
   - Melakukan `poll(Duration.ofMillis(timeoutMs))` untuk menarik stream pesan dari broker.
3. **Data & Schema Assertion**:
   - Katalon memvalidasi metadata event: `topic`, `partition`, `offset`, `key`.
   - Katalon memvalidasi JSON payload:
     ```json
     {
       "event_id": "EVT-1710000000000",
       "order_id": "ORD-2026-TKC-8899",
       "msisdn": "+670-77123456",
       "package_type": "DATA_PACKAGE_50GB",
       "price": 15.00,
       "currency": "USD",
       "status": "SUCCESS"
     }
     ```
   - Assertions:
     - Memastikan list pesan tidak kosong (`records.size() > 0`).
     - Memastikan status order adalah `SUCCESS`.
     - Memastikan currency adalah `USD` dan tipe paket sesuai.

---

## 🔄 Skenario 3: End-to-End Integration Flow
Menguji siklus hidup transaksi lengkap:
1. Katalon mem-produce transaksi via REST API POST request.
2. Katalon menangkap order ID yang terbentuk.
3. Transaksi dipublikasikan ke event streaming Kafka.
4. Katalon bertindak sebagai Consumer untuk mengonsumsi dan memvalidasi event Kafka secara real-time.
5. Katalon mengonsumsi data akhir melalui REST API GET request untuk memastikan data konsisten di seluruh lapisan sistem.

---

## 🛠️ Cara Menjalankan Project

### 1. (Opsional) Menjalankan Kafka Broker Lokal
Jika ingin menguji langsung ke broker Kafka lokal, jalankan container menggunakan Docker:
```bash
cd katalon_api_kafka_test
docker-compose up -d
```
*Broker Kafka akan aktif di `localhost:9092`.*

### 2. Membuka di Katalon Studio
1. Buka **Katalon Studio**.
2. Pilih menu **File** -> **Open Project**.
3. Navigasikan ke direktori `katalon_api_kafka_test` dan pilih file `katalon_api_kafka_test.prj`.
4. Buka folder **Test Suites** -> `Telecom_API_Kafka_TestSuite`.
5. Klik tombol **Run** (Web Service Mode).

### 3. Menjalankan via Katalon Runtime Engine (CLI / Headless)
```bash
katalonc -noSplash -runMode=console -projectPath="katalon_api_kafka_test/katalon_api_kafka_test.prj" -testSuitePath="Test Suites/Telecom_API_Kafka_TestSuite" -executionProfile="default"
```
