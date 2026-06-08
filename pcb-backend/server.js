require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const mqtt = require("mqtt");

// --- Configuración ---
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;

const HTTP_PORT = process.env.HTTP_PORT || 3001;
const WS_PORT   = process.env.WS_PORT   || 3002;

// --- Topics ---
const TOPIC_PULSADOR1 = "pcb/pulsadores/pulsador1";
const TOPIC_RELAY1_CMD = "pcb/relays/relay1/cmd";

// --- Servidor HTTP (Express) ---
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(HTTP_PORT, () => {
    console.log(`Servidor HTTP corriendo en puerto ${HTTP_PORT}`);
});

// --- Servidor WebSocket ---
const wss = new WebSocketServer({ port: WS_PORT });
const clientes = new Set();

wss.on("connection", (ws) => {
    clientes.add(ws);
    console.log(`Cliente WebSocket conectado. Total: ${clientes.size}`);

    // Mensaje entrante desde React
    ws.on("message", (data) => {
        try {
            const mensaje = JSON.parse(data);
            console.log("Mensaje desde React:", mensaje);

            // Si React manda un comando para el relay, lo publicamos en MQTT
            if (mensaje.topic && mensaje.payload) {
                mqttClient.publish(mensaje.topic, mensaje.payload);
                console.log(`Publicado en MQTT [${mensaje.topic}]: ${mensaje.payload}`);
            }
        } catch (err) {
            console.error("Error procesando mensaje WebSocket:", err);
        }
    });

    ws.on("close", () => {
        clientes.delete(ws);
        console.log(`Cliente WebSocket desconectado. Total: ${clientes.size}`);
    });
});

console.log(`Servidor WebSocket corriendo en puerto ${WS_PORT}`);

// --- Función para enviar a todos los clientes React conectados ---
function broadcast(data) {
    const mensaje = JSON.stringify(data);
    clientes.forEach((ws) => {
        if (ws.readyState === 1) {
            ws.send(mensaje);
        }
    });
}

// --- Cliente MQTT ---
const mqttClient = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`, {
    username: MQTT_USER,
    password: MQTT_PASS,
    rejectUnauthorized: false,
});

mqttClient.on("connect", () => {
    console.log("Conectado a HiveMQ MQTT");
    mqttClient.subscribe(TOPIC_PULSADOR1, (err) => {
        if (!err) console.log(`Suscripto a: ${TOPIC_PULSADOR1}`);
    });
});

mqttClient.on("message", (topic, payload) => {
    const valor = payload.toString();
    console.log(`Mensaje MQTT [${topic}]: ${valor}`);

    // Reenviar a todos los clientes React conectados por WebSocket
    broadcast({ topic, payload: valor });
});

mqttClient.on("error", (err) => {
    console.error("Error MQTT:", err.message);
});

mqttClient.on("disconnect", () => {
    console.log("Desconectado de MQTT");
});