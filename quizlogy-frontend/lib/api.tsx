import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Suppress console errors for 401 (unauthorized) - these are expected for guest users
    if (error.response?.status === 401) {
      // Silently handle 401 errors - user is not authenticated
      // Don't log to console to avoid noise
      return Promise.reject(error);
    }
    // For other errors, log them
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response?.status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

// Question API
export interface Question {
  id: string;
  contestId: string;
  question: string;
  type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media: string | null;
  options: string[];
  correctOption: string;
  order: number;
}

export const questionsApi = {
  getRandom: async (count: number = 2): Promise<Question[]> => {
    const response = await api.get('/api/questions/random', {
      params: { count },
    });
    return response.data.data || [];
  },
  getByCategories: async (categories: string[], count: number = 20): Promise<Question[]> => {
    const response = await api.get('/api/questions/by-categories', {
      params: { 
        categories: categories.join(','),
        count 
      },
    });
    return response.data.data || [];
  },
};

// Two Questions API (for intro page) - filtered by user country via IP or explicit param
export const twoQuestionsApi = {
  getRandom: async (
    count: number = 2,
    excludeIds: string[] = [],
    country?: string // ISO country code e.g. "IN", "US" or legacy "IND"/"ALL"
  ): Promise<Question[]> => {
    const params: any = { count };
    if (excludeIds && excludeIds.length > 0) {
      params.excludeIds = excludeIds.join(',');
    }
    if (country) {
      // Convert legacy region codes if passed
      if (country === 'IND') {
        params.country = 'IN';
      } else if (country !== 'ALL') {
        params.country = country;
      }
    }
    const response = await api.get('/api/two-questions/random', { params });
    return response.data.data || [];
  },
};

// FunFact API
export interface FunFact {
  id: string;
  title: string;
  description: string;
  imagePath: string | null;
  imageUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export const funfactsApi = {
  getAll: async (status?: 'ACTIVE' | 'INACTIVE'): Promise<FunFact[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/api/funfacts', { params });
    return response.data.data || [];
  },
};

// Contest API
export interface Contest {
  id: string;
  name: string;
  contestImage: string;
  category: string;
  categoryName?: string;
  categoryBackgroundColor?: string | null;
  categoryImagePath?: string | null;
  joining_fee: number;
  startDate: string | null;
  endDate: string | null;
  resultDate: string | null;
  status: string;
  winCoins: number;
  isDaily?: boolean;
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
}

export interface ContestListResponse {
  status: boolean;
  data: Contest[];
  totalResults: number;
  categories: string[];
}

export const contestsApi = {
  getList: async (params?: {
    category?: string;
    status?: string;
  }): Promise<ContestListResponse> => {
    const queryParams: any = { ...params };
    if (typeof window !== 'undefined') {
      const country = localStorage.getItem('userCountryCode');
      if (country && country !== 'UN') {
        queryParams.country = country;
      }
    }
    const response = await api.get('/api/contestList', { params: queryParams });
    return response.data;
  },
  
  // Join a contest (deducts coins)
  joinContest: async (contestId: string): Promise<{ status: boolean; message: string; coins: number }> => {
    const response = await api.post(`/api/contest/${contestId}/join`);
    return response.data;
  },
  
  // Get contest by ID with questions (passes user country for question filtering)
  getContestById: async (contestId: string): Promise<any> => {
    const params: any = {};
    if (typeof window !== 'undefined') {
      const country = localStorage.getItem('userCountryCode');
      if (country && country !== 'UN') {
        params.country = country;
      }
    }
    const response = await api.get(`/api/contest/${contestId}`, { params });
    return response.data;
  },
  
  // Use lifeline in contest (deducts coins)
  useLifeline: async (contestId: string, lifelineType: string): Promise<{ status: boolean; message: string; coins: number }> => {
    const response = await api.post(`/api/contest/${contestId}/use-lifeline`, { lifelineType });
    return response.data;
  },
  
  // Submit contest results
  submitContestResults: async (contestId: string, data: { score: number; answers: any[] }): Promise<any> => {
    try {
      const response = await api.post(`/api/contest/${contestId}/submit`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error in submitContestResults API call:', {
        contestId,
        error: error.response?.data || error.message,
        status: error.response?.status,
      });
      throw error; // Re-throw to let caller handle
    }
  },
  
  // Get user's rank in contest
  getContestRank: async (contestId: string): Promise<{ status: boolean; rank: number; score: number; totalParticipants: number }> => {
    const response = await api.get(`/api/contest/${contestId}/rank`);
    return response.data;
  },
  
  // Get contest leaderboard
  getContestLeaderboard: async (contestId: string, limit?: number): Promise<any> => {
    const response = await api.get(`/api/contest/${contestId}/leaderboard`, { params: { limit } });
    return response.data;
  },
};

// Category API
export interface Category {
  id: string;
  name: string;
  description?: string;
  imagePath?: string;
  image?: string; // Some APIs return 'image' instead of 'imagePath'
  imageUrl?: string;
  backgroundColor?: string | null;
  status?: string;
}

export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const params: any = {};
    if (typeof window !== 'undefined') {
      const country = localStorage.getItem('userCountryCode');
      if (country && country !== 'UN') params.country = country;
    }
    const response = await api.get('/api/getContestCategories', { params });
    return response.data.results || [];
  },
  getAllWithDetails: async (): Promise<Category[]> => {
    const params: any = { status: 'ACTIVE' };
    if (typeof window !== 'undefined') {
      const country = localStorage.getItem('userCountryCode');
      if (country && country !== 'UN') params.country = country;
    }
    const response = await api.get('/api/categories', { params });
    return response.data || [];
  },
};

// Auth API
export interface UserProfile {
  mobileNo?: string | null;
  whatsappNo?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  googleId?: string;
  coins?: number;
  picture?: string | null;
  profile?: UserProfile;
}

export const authApi = {
  // Initiate Google OAuth - redirects to Google
  googleLogin: () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    // Get returnUrl from localStorage if set
    const returnUrl = localStorage.getItem('loginReturnUrl');
    // Get current origin to determine if we're on frontend or admin
    const currentOrigin = window.location.origin;
    const isAdmin = currentOrigin.includes('3001') || currentOrigin.includes('admin');
    
    // Build the Google OAuth URL with returnUrl and origin as state parameter
    let authUrl = `${API_URL}/auth/google`;
    const params = new URLSearchParams();
    
    if (returnUrl) {
      params.append('state', returnUrl);
    }
    
    // Pass origin info so backend knows where to redirect
    if (isAdmin) {
      params.append('origin', 'admin');
    } else {
      params.append('origin', 'frontend');
    }
    
    if (params.toString()) {
      authUrl += `?${params.toString()}`;
    }
    
    window.location.href = authUrl;
  },
  
  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  // Update current user profile
  updateProfile: async (data: { 
    name?: string; 
    picture?: string | null;
    mobileNo?: string | null;
    whatsappNo?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    postalCode?: string | null;
  }): Promise<User> => {
    const response = await api.put('/auth/me', data);
    return response.data;
  },
  
  // Delete current user account
  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await api.delete('/auth/me');
    return response.data;
  },
  
  // Award coins to current user
  awardCoins: async (amount: number, description?: string, contestId?: string): Promise<{ status: boolean; message: string; coins: number }> => {
    const response = await api.post('/auth/me/award-coins', { amount, description, contestId });
    return response.data;
  },
  
  // Logout
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

// Coin API
export interface CoinHistory {
  id: string;
  userId: string;
  amount: number;
  type: 'EARNED' | 'SPENT' | 'REFUND' | 'LOGIN';
  description: string;
  contestId: string | null;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
  // Contest result details
  contestName?: string | null;
  correctAnswers?: number | null;
  wrongAnswers?: number | null;
  totalQuestions?: number | null;
  winningAmount?: number | null;
  timeTaken?: number | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CoinHistoryResponse {
  status: boolean;
  data: CoinHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const coinsApi = {
  // Get current user's coin balance
  getBalance: async (): Promise<{ status: boolean; coins: number }> => {
    const response = await api.get('/api/coins/balance');
    return response.data;
  },
  
  // Get current user's coin history
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    type?: 'EARNED' | 'SPENT' | 'REFUND' | 'LOGIN';
  }): Promise<CoinHistoryResponse> => {
    const response = await api.get('/api/coins/history', { params });
    return response.data;
  },
  
  // Get specific coin history entry by ID
  getHistoryById: async (id: string): Promise<{ status: boolean; data: CoinHistory }> => {
    const response = await api.get(`/api/coins/history/${id}`);
    return response.data;
  },
  
  // Create coin history entry
  createHistory: async (data: {
    amount: number;
    type: 'EARNED' | 'SPENT' | 'REFUND' | 'LOGIN';
    description: string;
    contestId?: string | null;
  }): Promise<{ status: boolean; message: string; data: CoinHistory }> => {
    const response = await api.post('/api/coins/history', data);
    return response.data;
  },
  
  // Update coin history entry
  updateHistory: async (
    id: string,
    data: {
      amount?: number;
      type?: 'EARNED' | 'SPENT' | 'REFUND' | 'LOGIN';
      description?: string;
      contestId?: string | null;
    }
  ): Promise<{ status: boolean; message: string; data: CoinHistory }> => {
    const response = await api.put(`/api/coins/history/${id}`, data);
    return response.data;
  },
  
  // Delete coin history entry
  deleteHistory: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/coins/history/${id}`);
    return response.data;
  },
};

// Wheel API
export interface WheelPrize {
  label: string;
  value: number;
  probability: number;
  color?: string;
}

export interface WheelData {
  id: string | null;
  name: string;
  spinCost: number;
  prizes: WheelPrize[];
}

export const wheelApi = {
  // Get active wheel configuration
  getWheel: async (): Promise<{ status: boolean; data: WheelData }> => {
    const response = await api.get('/api/wheel');
    return response.data;
  },
  
  // Spin the wheel
  spinWheel: async (): Promise<{
    status: boolean;
    message: string;
    data: {
      prize: { label: string; value: number };
      coins: number;
      spinId: string;
    };
  }> => {
    const response = await api.post('/api/wheel/spin');
    return response.data;
  },
  
  // Get spin history
  getHistory: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    status: boolean;
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get('/api/wheel/history', { params });
    return response.data;
  },
};

// Feedback API
export const feedbackApi = {
  // Send contact feedback
  sendContact: async (data: {
    name: string;
    email: string;
    message: string;
  }): Promise<{ status: boolean; message: string }> => {
    const response = await api.post('/api/feedback/contact', data);
    return response.data;
  },
  
  // Send issue report
  sendReport: async (data: {
    issueType?: string;
    description: string;
    email?: string;
  }): Promise<{ status: boolean; message: string }> => {
    const response = await api.post('/api/feedback/report-issue', data);
    return response.data;
  },
};

// Utility function to get full image URL - preserves paths from backend exactly
// Battle API
export interface Battle {
  id: string;
  name: string;
  description: string | null;
  imagePath: string;
  imageUrl?: string | null;
  backgroundColorTop?: string | null;
  backgroundColorBottom?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  questions?: any[];
}

export const battlesApi = {
  getAll: async (status?: 'ACTIVE' | 'INACTIVE'): Promise<Battle[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/api/battles', { params });
    return response.data.data || [];
  },
  
  getById: async (battleId: string): Promise<Battle> => {
    const response = await api.get(`/api/battles/${battleId}`);
    return response.data.data;
  },
  
  getQuestions: async (battleId: string): Promise<any[]> => {
    const response = await api.get(`/api/battles/${battleId}/questions`);
    return response.data.data || [];
  },
  
  // Use lifeline in battle (deducts coins)
  useLifeline: async (battleId: string, lifelineType: string): Promise<{ status: boolean; message: string; coins: number }> => {
    const response = await api.post(`/api/battles/${battleId}/use-lifeline`, { lifelineType });
    return response.data;
  },
};

export const getImageUrl = (imagePath: string | null | undefined, type: 'contest' | 'category' | 'battles' = 'contest'): string => {
  if (!imagePath || imagePath.trim() === '') {
    return '';
  }

  // If it's already a full URL, return it
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Get the API base URL from environment variable
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // If the path contains a slash, it's already a full path from backend - preserve it exactly
  if (imagePath.includes('/')) {
    const finalUrl = `${baseUrl}/${imagePath}`;
    return finalUrl;
  }

  // Only if it's just a filename (no path), construct the path using type parameter
  // Default to contests folder for contests, categories folder for categories, battles use categories folder
  // The onError handler in components will try the other folder if this fails
  const uploadPath = type === 'category' || type === 'battles' ? 'uploads/categories' : 'uploads/contests';
  return `${baseUrl}/${uploadPath}/${imagePath}`;
};

