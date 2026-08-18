#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <WiFiManager.h>

WiFiManager wm;

// --- Configuración MQTT ---
const char* MQTT_HOST = "920ace17743940d19bee775522140b94.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USER = "esp32_user";
const char* MQTT_PASSWORD = "//EJ@Devices#5479!";
const char* MQTT_CLIENT_ID = "esp32-pcb-test";

// --- Pines ---
const int PIN_PULSADOR1 = 15;
const int PIN_RELAY1 = 13;
const int PIN_RESET = 4;
const int PIN_LED_CONFIG = 32;

// --- Variables para detección de RESET long-press ---
bool botonPresionado = false;
unsigned long tiempoInicioPresion = 0;
const unsigned long DURACION_LONG_PRESS = 5000; // 5 segundos
bool resetDisparado = false;

// --- Topics ---
const char* TOPIC_PULSADOR1 = "pcb/pulsadores/pulsador1";
const char* TOPIC_RELAY1_CMD = "pcb/relays/relay1/cmd";
const char* TOPIC_RELAY1_STATE = "pcb/relays/relay1/estado";

// --- Variables de estado ---
bool estadoRelay1 = false;
int ultimoPulsador1 = -1;

// --- Objetos ---
WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

// --- Callback: Mensajes MQTT entrantes ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String mensaje = "";
  for (unsigned int i = 0; i < length; i++) {
    mensaje += (char)payload[i];
  }

  Serial.println("Mensaje recibido [" + String(topic) + "]: " + mensaje);

  if (String(topic) == TOPIC_RELAY1_CMD) {
    if (mensaje == "ON") {
      estadoRelay1 = true;
      digitalWrite(PIN_RELAY1, HIGH);
      Serial.println("Relay 1 encendido");
      mqttClient.publish(TOPIC_RELAY1_STATE, "ON");
    } else if (mensaje == "OFF") {
      estadoRelay1 = false;
      digitalWrite(PIN_RELAY1, LOW);
      Serial.println("Relay 1 apagado");
      mqttClient.publish(TOPIC_RELAY1_STATE, "OFF");
    }
  }
}

// --- Conexión MQTT ---
void conectarMQTT() {
  wifiClient.setInsecure(); // Omite validación de certificado (válido para desarrollo)

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  while (!mqttClient.connected()) {
    Serial.print("Conectado a MQTT...");
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("conectado.");
      mqttClient.subscribe(TOPIC_RELAY1_CMD);
    } else {
      Serial.println("Error: " + String(mqttClient.state()) + ". Reintentando en 3s...");
      delay(3000);
    }
  }
}

void chequearLongPress() {
  bool estadoActual = (digitalRead(PIN_RESET) == LOW); // PRESIONADO

  if (estadoActual && !botonPresionado) {
    // flanco de bajada: arranca la cuenta
    botonPresionado = true;
    tiempoInicioPresion = millis();
    resetDisparado = false;
  } else if (estadoActual && botonPresionado && !resetDisparado) {
    // sigue presionado, chequeo si ya pasaron los 5 segundos
    if (millis() - tiempoInicioPresion >= DURACION_LONG_PRESS) {
      resetDisparado = true;
      dispararResetWiFi();
    }
  } else if (!estadoActual && botonPresionado) {
    // se soltó el botón
    botonPresionado = false;
  }
}

void dispararResetWiFi() {
  Serial.println("RESET detectado. Borrando credenciales WiFi...");

  // feedback visual: parpadeo rápido de LED antes de reiniciar
  for (int i = 0; i < 6, i++) {
    digitalWrite(PIN_LED_CONFIG, !digitalRead(PINT_LED_CONFIG));
    delay(150); // este delay es aceptable, no bloquea nada
  }

  wm.resetSettings(); // Borra credenciales guardadas
  delay(500);
  ESP.restart(); // Reinicia el ESP32
}

// --- Setup ---
void setup() {
  Serial.begin(115200);

  pinMode(PIN_PULSADOR1, INPUT);
  pinMode(PIN_RELAY1, OUTPUT);
  pinMode(PIN_RESET, INPUT);
  pinMode(PIN_LED_CONFIG, OUTPUT);

  digitalWrite(PIN_RELAY1, LOW);
  digitalWrite(PIN_LED_CONFIG, LOW);


  // --- Conexión WiFi ---

  // WiFi Manager intenta conectar con credenciales guardadas.
  // Si no hay o falla, levanta el AP automáticamente
  bool conectado = wm.autoConnect("EJDevices-Setup");

  if (!conectado) {
    Serial.println("Fallo al conectar y configurar WiFi. Reiniciando...");
    delay(3000);
    ESP.restart();
  }

  conectarMQTT();
}

// --- Loop ---
void loop() {

  chequearLongPress();

  // Mantener conexión MQTT activa
  if (!mqttClient.connected()) {
    conectarMQTT();
  }
  mqttClient.loop();

  // Leer pulsador y publicar si cambió
  int estadoPulsador1 = digitalRead(PIN_PULSADOR1);
  if (estadoPulsador1 != ultimoPulsador1) {
    ultimoPulsador1 = estadoPulsador1;
    String valor = (estadoPulsador1 == HIGH) ? "HIGH" : "LOW";
    mqttClient.publish(TOPIC_PULSADOR1, valor.c_str());
    Serial.println("Pulsador 1: " + valor);
  }

  delay(50);
}