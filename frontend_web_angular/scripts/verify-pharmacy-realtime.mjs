import { io } from 'socket.io-client';

const apiUrl = 'http://127.0.0.1:3000/api/v1';
const medicalReservationId = process.argv[2];
if (!medicalReservationId) throw new Error('medicalReservationId est requis.');

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload.message ?? path}`);
  return payload.data;
}

async function login(identifier, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

const [client, pharmacy, courier] = await Promise.all([
  login('+221772345678', 'client123'),
  login('+221780000101', 'pharmacie123'),
  login('+221773456789', 'prof12345'),
]);

const nearby = await request(
  '/pharmacy-orders/nearby?latitude=14.7167&longitude=-17.4677&radiusKm=25',
  { headers: authHeaders(client.accessToken) },
);
const target = nearby.find((candidate) => candidate.name === 'Pharmacie de la Corniche');
if (!target) throw new Error('Pharmacie de la Corniche introuvable.');

const order = await request('/pharmacy-orders', {
  method: 'POST',
  headers: authHeaders(client.accessToken, { 'Content-Type': 'application/json' }),
  body: JSON.stringify({ medicalReservationId, pharmacyId: target.id }),
});
await request(`/pharmacy-orders/${order.id}/validation`, {
  method: 'PATCH',
  headers: authHeaders(pharmacy.accessToken, { 'Content-Type': 'application/json' }),
  body: JSON.stringify({ status: 'EN_ATTENTE_PAIEMENT', medicineAmount: 8_500 }),
});
await request(`/pharmacy-orders/${order.id}/payment`, {
  method: 'POST',
  headers: authHeaders(client.accessToken, {
    'Content-Type': 'application/json',
    'Idempotency-Key': `realtime-${order.id}`,
  }),
  body: JSON.stringify({
    method: 'WAVE',
    successUrl: 'http://127.0.0.1:4200/success',
    cancelUrl: 'http://127.0.0.1:4200/cancel',
  }),
});

const realtimeResult = await new Promise((resolve, reject) => {
  const socket = io('http://127.0.0.1:3000/socket', {
    auth: { token: courier.accessToken },
    transports: ['websocket', 'polling'],
  });
  const timeout = setTimeout(() => {
    socket.disconnect();
    reject(new Error('Aucune notification temps reel recue sous 10 secondes.'));
  }, 10_000);

  socket.on('connect_error', (error) => {
    clearTimeout(timeout);
    socket.disconnect();
    reject(error);
  });
  socket.on('notification.created', (notification) => {
    if (notification.data?.pharmacyOrderId !== order.id) return;
    clearTimeout(timeout);
    socket.disconnect();
    resolve({
      connected: true,
      orderId: order.id,
      notificationTitle: notification.title,
      notificationRoute: notification.data.route,
    });
  });
  socket.on('connect', () => {
    request(`/pharmacy-orders/${order.id}/payment/mock-confirm`, {
      method: 'POST',
      headers: authHeaders(client.accessToken, { 'Content-Type': 'application/json' }),
      body: '{}',
    }).catch(reject);
  });
});

console.log(JSON.stringify(realtimeResult));
