import { api } from './api';

export const visitorTrackingApi = {
  trackVisit: async (page: string, screenResolution?: string) => {
    try {
      await api.post('/api/visitor/visit', { page, screenResolution });
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Failed to track visit:', error);
    }
  },

  trackExit: async (page: string) => {
    try {
      // Use sendBeacon for more reliable exit tracking
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ page })], { type: 'application/json' });
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/visitor/exit`;
        navigator.sendBeacon(url, blob);
      } else {
        // Fallback to fetch
        await api.post('/api/visitor/exit', { page });
      }
    } catch (error) {
      // Silently fail
      console.error('Failed to track exit:', error);
    }
  },

  trackClick: async (element?: string, page?: string) => {
    try {
      await api.post('/api/visitor/click', { element, page });
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Failed to track click:', error);
    }
  },

  resetSession: async () => {
    try {
      await api.post('/api/visitor/reset-session');
    } catch (error) {
      console.error('Failed to reset session:', error);
    }
  },

  getVisitorInfo: async () => {
    try {
      const response = await api.get('/api/visitor/info');
      return response.data;
    } catch (error) {
      console.error('Failed to get visitor info:', error);
      return null;
    }
  },
};

