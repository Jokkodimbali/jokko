import { io } from 'socket.io-client';

const apiUrl = 'http://127.0.0.1:3000/api/v1';
const socketUrl = 'http://127.0.0.1:3000/socket';
const reservationId = process.argv[2];
if (!reservationId) throw new Error('reservationId est requis.');

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

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const [client, courier] = await Promise.all([
  login('+221772345678', 'client123'),
  login('+221773456789', 'prof12345'),
]);

const result = await new Promise((resolve, reject) => {
  const clientSocket = io(socketUrl, {
    auth: { token: client.accessToken },
    transports: ['websocket', 'polling'],
  });
  const timeout = setTimeout(() => {
    clientSocket.disconnect();
    reject(new Error('Aucune position temps reel recue sous 12 secondes.'));
  }, 12_000);

  clientSocket.on('connect_error', reject);
  clientSocket.on('tracking.location.updated', (event) => {
    if (event.reservationId !== reservationId) return;
    clearTimeout(timeout);
    clientSocket.disconnect();
    resolve({
      connected: true,
      reservationId,
      latitude: event.latitude,
      longitude: event.longitude,
      positionTimestamp: event.positionTimestamp,
    });
  });
  clientSocket.on('connect', async () => {
    clientSocket.emit('tracking.subscribe', { reservationId });
    try {
      await request(`/reservations/${reservationId}/on-the-way`, {
        method: 'PATCH',
        headers: authHeaders(courier.accessToken),
        body: JSON.stringify({
          latitude: 14.7062,
          longitude: -17.4758,
          accuracyMeters: 8,
          recordedAt: new Date().toISOString(),
          locationLabel: 'Pharmacie Mermoz, Dakar',
        }),
      });
      await request(`/reservations/${reservationId}/live-tracking/location`, {
        method: 'PATCH',
        headers: authHeaders(courier.accessToken),
        body: JSON.stringify({
          latitude: 14.707,
          longitude: -17.473,
          accuracyMeters: 7,
          headingDegrees: 92,
          speedKmh: 24,
          recordedAt: new Date(Date.now() + 1_000).toISOString(),
          locationLabel: 'En route vers le client',
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      clientSocket.disconnect();
      reject(error);
    }
  });
});

console.log(JSON.stringify(result));
