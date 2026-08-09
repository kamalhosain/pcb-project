import React, { useState, useEffect } from "react";
import "./App.css";

const WS_URL = "wss://pcb-project-67pm.onrender.com";

function App() {
  const [wsConectado, setWsConectado] = useState(false);
  const [pulsador1, setPulsador1] = useState("--");
  const [relay1, setRelay1] = useState(false);
  const wsRef = React.useRef(null);

  // --- Conexión WebSocket ---
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket conectado");
      setWsConectado(true);
    };

    ws.onmessage = (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        console.log("Mensaje recibido:", mensaje);

        if (mensaje.topic === "pcb/pulsadores/pulsador1") {
          setPulsador1(mensaje.payload);
        }

        if (mensaje.topic === "pcb/relays/relay1/estado") {
          setRelay1(mensaje.payload === "ON");
        }
      } catch (err) {
        console.error("Error procesando mensaje:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket desconectado");
      setWsConectado(false);
    };

    ws.onerror = (err) => {
      console.error("Error WebSocket:", err);
    };

    return () => {
      ws.close();
    };
  }, []);

  // --- Comando Relay ---
  const toggleRelay1 = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const nuevoEstado = !relay1;
      const mensaje = {
        topic: "pcb/relays/relay1/cmd",
        payload: nuevoEstado ? "ON" : "OFF",
      };
      wsRef.current.send(JSON.stringify(mensaje));
      setRelay1(nuevoEstado);
  } else {
    console.error("WebSocket no está conectado");
  }
};

// --- UI ---
return (
  <div className="app">
      <h1>PCB Test</h1>

      <div className="estado-ws">
        <span className={wsConectado ? "punto verde" : "punto rojo"}></span>
        {wsConectado ? "Conectado" : "Desconectado"}
      </div>

      <div className="card">
        <h2>Pulsador 1</h2>
        <div className={`valor ${pulsador1 === "HIGH" ? "high" : "low"}`}>
          {pulsador1}
        </div>
      </div>

      <div className="card">
        <h2>Relay 1</h2>
        <button
          className={`boton-relay ${relay1 ? "encendido" : "apagado"}`}
          onClick={toggleRelay1}
        >
          {relay1 ? "ENCENDIDO" : "APAGADO"}
        </button>
      </div>
    </div>
  );
}

export default App;