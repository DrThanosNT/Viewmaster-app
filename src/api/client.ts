import AsyncStorage from '@react-native-async-storage/async-storage';

// Point this at your deployed backend once it's hosted (Railway/Render/etc).
// Use your computer's LAN IP (not localhost) when testing on a phone.
const BASE_URL = 'http://192.168.1.122:4000';

async function getToken() {
  return AsyncStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (phone: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),

  getLocations: () => request('/locations'),

  searchItems: (search: string) =>
    request(`/items?search=${encodeURIComponent(search)}`),

  createItem: (name: string, kind: 'DISCRETE' | 'CONSUMABLE' = 'DISCRETE') =>
    request('/items', { method: 'POST', body: JSON.stringify({ name, kind }) }),

  moveStock: (payload: {
    itemId: string;
    fromLocationId?: string;
    toLocationId: string;
    quantity: number;
    note?: string;
  }) => request('/movements', { method: 'POST', body: JSON.stringify(payload) }),

  getMovements: (params: { itemId?: string; locationId?: string } = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/movements${qs ? `?${qs}` : ''}`);
  },

  getEvents: () => request('/events'),

  getEvent: (id: string) => request(`/events/${id}`),
};
