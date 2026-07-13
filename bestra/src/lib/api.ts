/**
 * ENVIRONMENT CONFIGURATION:
 * For Local Dev: Uses the values below or defaults to localhost.
 */

// @ts-ignore - Lynx does not have 'process', so we must check safely
const getEnv = (key: string, fallback: string) => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    // @ts-ignore
    if (typeof import.meta.env !== 'undefined' && import.meta.env[key]) return import.meta.env[key];
  } catch (e) {}
  return fallback;
};

const SERVER_IP = getEnv('PUBLIC_SERVER_IP', '192.168.1.21'); 
const PORT = getEnv('PUBLIC_PORT', '3000');
const BASE_URL = getEnv('PUBLIC_API_URL', `http://${SERVER_IP}:${PORT}/api`);

export const WEBTRANSPORT_URL = getEnv('PUBLIC_WEBTRANSPORT_URL', `https://${SERVER_IP}:4433`);

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const defaultOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-mock-user': 'user_2t4v_dev_test', // Mock ID for testing
        ...options.headers,
      },
    };

    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Fetch failed for ${endpoint}, returning mock data:`, error);
    
    // MOCK DATA FALLBACK for testing
    // If it's a POST/PUT/DELETE, return the payload back to simulate success
    if (options.method && options.method !== 'GET') {
      try {
        const payload = options.body ? JSON.parse(options.body as string) : {};
        return { 
          ...payload, 
          id: `mock-${Date.now()}`, 
          createdAt: new Date().toISOString(),
          message: 'Mock Success (Backend Unreachable)' 
        };
      } catch (e) {
        return { success: true, message: 'Mock Success' };
      }
    }

    if (endpoint.includes('/messages/users')) {
      return [
        { id: 'user_other_dev_test', fullName: 'Bob (Mock)', username: 'bob', email: 'bob@test.com' }
      ];
    }
    
    // Exact match for message history, don't trigger for /clear/ or other paths
    if (endpoint.match(/^\/messages\/[^\/]+$/)) {
      return [
        { id: '1', text: 'Backend unreachable. Using mock mode.', senderId: 'user_other_dev_test', receiverId: 'user_2t4v_dev_test', createdAt: new Date().toISOString() }
      ];
    }
    
    return [];
  }
};
