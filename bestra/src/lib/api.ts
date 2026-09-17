/**
 * Environment variables must be accessed by their literal names. Rspeedy
 * replaces these references while compiling the Lynx bundle; bracket access
 * (for example `import.meta.env[key]`) is left unresolved in the app.
 */

const SERVER_IP = import.meta.env.PUBLIC_SERVER_IP || '192.168.1.21';
const PORT = import.meta.env.PUBLIC_PORT || '3000';

const BASE_URL =
  import.meta.env.PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? '/api'
    : `http://${SERVER_IP}:${PORT}/api`);

export const WEBTRANSPORT_URL =
  import.meta.env.PUBLIC_WEBTRANSPORT_URL ||
  `https://${SERVER_IP}:4433`;

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const url = `${BASE_URL}${endpoint}`;

  try {
    const defaultOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-mock-user': 'user_2t4v_dev_test',
        ...options.headers,
      },
    };

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API error: ${response.status}`
      );
    }

    return response.json();
  } catch (error) {
    console.error(
      `Fetch failed for ${endpoint}, returning mock data:`,
      error
    );

    // MOCK DATA FALLBACK for testing
    if (options.method && options.method !== 'GET') {
      try {
        const payload = options.body
          ? JSON.parse(options.body as string)
          : {};

        return {
          ...payload,
          id: `mock-${Date.now()}`,
          createdAt: new Date().toISOString(),
          message: 'Mock Success (Backend Unreachable)',
        };
      } catch (e) {
        return {
          success: true,
          message: 'Mock Success',
        };
      }
    }

    if (endpoint.includes('/messages/users')) {
      return [
        {
          id: 'user_other_dev_test',
          fullName: 'Bob (Mock)',
          username: 'bob',
          email: 'bob@test.com',
        },
      ];
    }

    if (endpoint.match(/^\/messages\/[^\/]+$/)) {
      return [
        {
          id: '1',
          text: 'Backend unreachable. Using mock mode.',
          senderId: 'user_other_dev_test',
          receiverId: 'user_2t4v_dev_test',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return [];
  }
};
