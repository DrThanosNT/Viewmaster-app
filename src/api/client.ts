import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.122:4000';

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function getToken() {
  return AsyncStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (res.status === 401) {
    await AsyncStorage.multiRemove(['token', 'user']);
    if (onUnauthorized) onUnauthorized();
    throw new Error('Η σύνδεσή σου έληξε. Παρακαλώ συνδέσου ξανά.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (phone: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),

  getLocations: () => request('/locations'),
  getLocation: (id: string) => request(`/locations/${id}`),
  createLocation: (payload: { name: string; type: 'STORAGE' | 'VEHICLE' | 'OTHER'; address?: string }) =>
    request('/locations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteLocation: (id: string) => request(`/locations/${id}`, { method: 'DELETE' }),

  searchItems: (search: string) => request(`/items?search=${encodeURIComponent(search)}`),
  createItem: (name: string, kind: 'DISCRETE' | 'CONSUMABLE' = 'DISCRETE') =>
    request('/items', { method: 'POST', body: JSON.stringify({ name, kind }) }),
  deleteItem: (id: string) => request(`/items/${id}`, { method: 'DELETE' }),

  moveStock: (payload: { itemId: string; fromLocationId?: string; toLocationId: string; quantity: number; note?: string }) =>
    request('/movements', { method: 'POST', body: JSON.stringify(payload) }),

  moveStockBatch: (payload: {
    lines: { itemId: string; locationId?: string; fromEventId?: string | null; toLocationId: string; toEventId?: string | null; quantity: number; temporary?: boolean; expectedReturnAt?: string | null }[];
    note?: string;
  }) => request('/movements/batch', { method: 'POST', body: JSON.stringify(payload) }),

  exportStockBatch: (payload: { lines: { itemId: string; locationId: string; eventId?: string | null; quantity: number; fromDamaged?: boolean }[]; note?: string }) =>
    request('/movements/export-batch', { method: 'POST', body: JSON.stringify(payload) }),
  returnStockBatch: (payload: { lines: { itemId: string; locationId: string; eventId?: string | null; quantity: number }[]; note?: string }) =>
    request('/movements/return-batch', { method: 'POST', body: JSON.stringify(payload) }),
  damageStockBatch: (payload: { lines: { itemId: string; locationId: string; eventId?: string | null; quantity: number }[]; note?: string }) =>
    request('/movements/damage-batch', { method: 'POST', body: JSON.stringify(payload) }),
  repairStockBatch: (payload: { lines: { itemId: string; locationId: string; eventId?: string | null; quantity: number }[]; note?: string }) =>
    request('/movements/repair-batch', { method: 'POST', body: JSON.stringify(payload) }),

  getMovements: (params: { itemId?: string; locationId?: string } = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/movements${qs ? `?${qs}` : ''}`);
  },
  getLogs: (take?: number) => request(`/movements/logs${take ? `?take=${take}` : ''}`),

  getDamagedStock: () => request('/stock/damaged'),
  getTemporaryStock: () => request('/stock/temporary'),
  setRunningLow: (itemId: string, locationId: string, eventId: string | null, value: boolean) =>
    request('/stock/running-low', { method: 'PATCH', body: JSON.stringify({ itemId, locationId, eventId, value }) }),

  getEvents: () => request('/events'),
  getEvent: (id: string) => request(`/events/${id}`),
  createEvent: (payload: { name: string; startDate: string; endDate: string; locationIds: string[] }) =>
    request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  updateEvent: (id: string, payload: { name?: string; startDate?: string; endDate?: string }) =>
    request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteEvent: (id: string) => request(`/events/${id}`, { method: 'DELETE' }),

  getUsers: () => request('/auth/users'),
  createUser: (payload: { name: string; phone: string; password: string; role: 'WORKER' | 'MANAGER' | 'ADMIN' }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  deleteUser: (id: string) => request(`/auth/users/${id}`, { method: 'DELETE' }),
  updateUserRole: (id: string, role: string) => request(`/auth/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  updateMyPhoto: (photoUrl: string | null) => request('/auth/me/photo', { method: 'PATCH', body: JSON.stringify({ photoUrl }) }),
  getMe: () => request('/auth/me'),
};
