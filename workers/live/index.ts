import 'dotenv/config';

/**
 * Live Worker
 *
 * Escuta dados ao vivo via MQTT do OpenF1 e retransmite para browsers via WebSocket.
 * Não grava nada no banco — é um relay puro.
 *
 * Dados transmitidos:
 *   - position:     posições ao vivo dos pilotos
 *   - laps:         tempos de volta e setores
 *   - intervals:    gaps entre pilotos
 *   - race_control: bandeiras, safety car, mensagens
 *   - weather:      clima na pista
 *   - car_data:     telemetria (velocidade, RPM, marcha, acelerador, freio, DRS)
 *   - stints:       pneus (composto, idade, stint atual)
 *   - session:      status da sessão (started, ended)
 *
 * Uso:
 *   npm run dev   (watch mode)
 *   npm run start (produção)
 *
 * Frontend conecta via:
 *   const ws = new WebSocket("ws://IP:PORTA")
 *
 * Mensagens recebidas no browser:
 *   { event: "position", data: {...}, timestamp: 1234567890 }
 */

import { WebSocketServer, WebSocket } from 'ws';
import mqtt from 'mqtt';

const WS_PORT = parseInt(process.env.LIVE_WS_PORT || '8080', 10);
const MQTT_BROKER = process.env.OPENF1_MQTT_BROKER || 'mqtt://localhost:1883';
const MQTT_USER = process.env.OPENF1_MQTT_USER || 'openf1';
const MQTT_PASS = process.env.OPENF1_MQTT_PASS || 'openf1';

// ── WebSocket server (browsers) ──────────────────────────────────────────────

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[live] Cliente conectado (${clients.size} total)`);

  // Envia estado atual da sessão ao conectar
  if (currentSessionStatus) {
    ws.send(JSON.stringify({
      event: 'session',
      data: currentSessionStatus,
      timestamp: Date.now(),
    }));
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[live] Cliente desconectado (${clients.size} total)`);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

function broadcast(event: string, data: unknown) {
  if (clients.size === 0) return;

  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ── Estado da sessão (cache para novos clientes) ────────────────────────────

let currentSessionStatus: unknown = null;

// ── MQTT client (escuta OpenF1) ──────────────────────────────────────────────

const TOPICS = [
  'v1/position',
  'v1/laps',
  'v1/intervals',
  'v1/race_control',
  'v1/weather',
  'v1/car_data',
  'v1/stints',
  'v1/session',
];

const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS,
});

mqttClient.on('connect', () => {
  console.log(`[live] Conectado ao MQTT broker: ${MQTT_BROKER}`);
  mqttClient.subscribe(TOPICS, (err) => {
    if (err) {
      console.error('[live] Erro ao inscrever:', err);
    } else {
      console.log(`[live] Inscrito em ${TOPICS.length} tópicos`);
    }
  });
});

mqttClient.on('message', (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    const event = topic.replace('v1/', '');

    // Cacheia status da sessão
    if (event === 'session') {
      currentSessionStatus = data;
    }

    broadcast(event, data);
  } catch {
    // Payload não é JSON, ignora
  }
});

mqttClient.on('error', (err) => {
  console.error('[live] Erro MQTT:', err);
});

mqttClient.on('offline', () => {
  console.warn('[live] MQTT desconectado, reconectando...');
});

// ── Inicialização ────────────────────────────────────────────────────────────

console.log(`[live] WebSocket server na porta ${WS_PORT}`);
console.log(`[live] Conectando ao MQTT broker...`);
