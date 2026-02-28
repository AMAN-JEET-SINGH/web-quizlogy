import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
    console.log('📤 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasCredentials: config.withCredentials,
    });
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Skip logging for blob responses (CSV exports, etc.)
    if (response.config.responseType === 'blob') {
      return response;
    }
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    // Enhanced error logging for network errors
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL}${error.config?.url}`,
      } : 'No response',
      request: error.request ? 'Request made but no response' : 'No request',
    };
    
    console.error('❌ API Error:', errorDetails);
    
    // Log specific network error details
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      console.error('🌐 Network Error Details:', {
        code: error.code,
        message: error.message,
        targetURL: `${error.config?.baseURL}${error.config?.url}`,
        apiURL: API_URL,
        suggestion: 'Check if backend server is running and accessible',
      });
    }
    
    // 401 errors are handled by AdminProvider's checkStatus — no hard redirect here.
    // The AdminProvider will set isAdmin=false which triggers a graceful router.push to /auth/login.
    return Promise.reject(error);
  }
);

// Admin API
export const adminApi = {
  login: async (username: string, password: string) => {
    console.log('🔐 Admin login attempt:', { username, password: password ? '***' : 'empty' });
    try {
      const response = await api.post('/api/admin/login', { username, password });
      console.log('✅ Login successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Login failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  },

  logout: async () => {
    const response = await api.post('/api/admin/logout');
    return response.data;
  },

  checkStatus: async (): Promise<{ isAdmin: boolean; adminData?: any }> => {
    const response = await api.get('/api/admin/status', { timeout: 5000 });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.post('/api/admin/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

// Admin User interface
export interface AdminUser {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  allowedSections: string[];
  adsenseAllowedDomains: string[];
  adsenseAllowedCountries: string[];
  adsenseRevenueShare: number;
  adsenseDomainDeductions?: Record<string, number>;
  webAppLinks: Array<{label: string; url: string}>;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateAdminUserData {
  username: string;
  password: string;
  allowedSections?: string[];
  adsenseAllowedDomains?: string[];
  adsenseAllowedCountries?: string[];
  adsenseRevenueShare?: number;
  adsenseDomainDeductions?: Record<string, number>;
  webAppLinks?: Array<{label: string; url: string}>;
  isActive?: boolean;
}

export interface UpdateAdminUserData {
  username?: string;
  password?: string;
  allowedSections?: string[];
  adsenseAllowedDomains?: string[];
  adsenseAllowedCountries?: string[];
  adsenseRevenueShare?: number;
  adsenseDomainDeductions?: Record<string, number>;
  webAppLinks?: Array<{label: string; url: string}>;
  isActive?: boolean;
}

// Admin Users API
export const adminUsersApi = {
  getAll: async (): Promise<{ status: boolean; data: AdminUser[] }> => {
    const response = await api.get('/api/admin-users');
    return response.data;
  },

  getById: async (id: string): Promise<{ status: boolean; data: AdminUser }> => {
    const response = await api.get(`/api/admin-users/${id}`);
    return response.data;
  },

  getSections: async (): Promise<{ status: boolean; sections: string[] }> => {
    const response = await api.get('/api/admin-users/sections');
    return response.data;
  },

  create: async (data: CreateAdminUserData): Promise<{ status: boolean; message: string; data: AdminUser }> => {
    const response = await api.post('/api/admin-users', data);
    return response.data;
  },

  update: async (id: string, data: UpdateAdminUserData): Promise<{ status: boolean; message: string; data: AdminUser }> => {
    const response = await api.put(`/api/admin-users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/admin-users/${id}`);
    return response.data;
  },

  toggleActive: async (id: string): Promise<{ status: boolean; message: string; data: { id: string; username: string; isActive: boolean } }> => {
    const response = await api.patch(`/api/admin-users/${id}/toggle-active`);
    return response.data;
  },
};

// Country API (for multi-country feature)
export interface AppCountry {
  code: string;
  name: string;
  flagUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const countriesApi = {
  getActive: async (): Promise<{ status: boolean; data: AppCountry[] }> => {
    const response = await api.get('/api/countries');
    return response.data;
  },

  getAll: async (): Promise<{ status: boolean; data: AppCountry[] }> => {
    const response = await api.get('/api/countries/all');
    return response.data;
  },

  create: async (data: { code: string; name: string; flagUrl?: string; isActive?: boolean }): Promise<{ status: boolean; data: AppCountry }> => {
    const response = await api.post('/api/countries', data);
    return response.data;
  },

  update: async (code: string, data: { name?: string; flagUrl?: string; isActive?: boolean }): Promise<{ status: boolean; data: AppCountry }> => {
    const response = await api.put(`/api/countries/${code}`, data);
    return response.data;
  },

  delete: async (code: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/countries/${code}`);
    return response.data;
  },

  seed: async (): Promise<{ status: boolean; message: string; data: AppCountry[] }> => {
    const response = await api.post('/api/countries/seed');
    return response.data;
  },
};

// Category API
export interface Category {
  id: string;
  name: string;
  description: string | null;
  imagePath: string;
  imageUrl?: string;
  backgroundColor?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  countries?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  imagePath: string;
  backgroundColor?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  countries?: string[];
}

export const categoriesApi = {
  getAll: async (status?: 'ACTIVE' | 'INACTIVE'): Promise<Category[]> => {
    const params: any = { country: 'ALL' };
    if (status) params.status = status;
    const response = await api.get('/api/categories', { params });
    return response.data;
  },

  getContestCategories: async (): Promise<{
    status: boolean;
    results: Array<{
      id: string;
      name: string;
      description: string;
      image: string;
      status: string;
    }>;
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  }> => {
    const response = await api.get('/api/getContestCategories');
    return response.data;
  },

  getById: async (id: string): Promise<Category> => {
    const response = await api.get(`/api/categories/${id}`);
    return response.data;
  },

  create: async (data: CreateCategoryData): Promise<Category> => {
    const response = await api.post('/api/categories', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateCategoryData>): Promise<Category> => {
    const response = await api.put(`/api/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/categories/${id}`);
  },

  toggleStatus: async (id: string): Promise<Category> => {
    const response = await api.patch(`/api/categories/${id}/toggle-status`);
    return response.data;
  },
};

// Contest API
export interface Contest {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
  imagePath: string;
  imageUrl?: string;
  startDate: string | null;
  endDate: string | null;
  resultDate: string | null;
  isDaily?: boolean;
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
  joiningFee: number;
  questionCount: number;
  duration: number;
  region: string;
  countries?: string[];
  prizePool: string;
  marking: number;
  negativeMarking: number;
  lifeLineCharge: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContestData {
  name: string;
  description?: string;
  categoryId: string;
  imagePath: string;
  startDate?: string | null;
  endDate?: string | null;
  resultDate?: string | null;
  isDaily?: boolean;
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
  joiningFee?: number;
  questionCount?: number;
  duration?: number;
  region?: string;
  countries?: string[];
  prizePool?: string | string[];
  marking?: number;
  negativeMarking?: number;
  lifeLineCharge?: number;
}

export interface ContestsResponse {
  status: boolean;
  data: Contest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const contestsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    all?: string;
  }): Promise<ContestsResponse> => {
    const response = await api.get('/api/contests', { params });
    return response.data;
  },

  getList: async (params?: {
    category?: string;
    status?: string;
    region?: string;
  }): Promise<{
    status: boolean;
    data: Array<{
      id: string;
      name: string;
      contestImage: string;
      category: string;
      joining_fee: number;
      startDate: string;
      endDate: string;
      resultDate: string;
      status: string;
      winCoins: number;
    }>;
    totalResults: number;
    categories: string[];
  }> => {
    const response = await api.get('/api/contestList', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Contest> => {
    const response = await api.get(`/api/contests/${id}`);
    return response.data;
  },

  getDetail: async (id: string): Promise<{
    status: boolean;
    data: any;
    alreadyPlayed: boolean;
  }> => {
    const response = await api.get(`/api/contest/${id}`);
    return response.data;
  },

  create: async (data: CreateContestData): Promise<Contest> => {
    const response = await api.post('/api/contests', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateContestData>): Promise<Contest> => {
    const response = await api.put(`/api/contests/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/contests/${id}`);
  },
};

// Question API
export interface Question {
  id: string;
  contestId: string;
  question: string;
  type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media: string | null;
  options: string[] | Array<{ text: string; image: string }>;
  correctOption: string;
  countries?: string[];
  order: number;
}

export interface CreateQuestionData {
  question: string;
  type?: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media?: string;
  options: string[];
  correctOption: string;
  countries?: string[];
  order?: number;
}

export interface QuestionWithContest extends Question {
  contest?: {
    id: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
    region?: string;
    countries?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export const questionsApi = {
  getAll: async (params?: {
    categoryId?: string;
    contestId?: string;
    type?: string;
    region?: string;
    country?: string;
    level?: string;
    search?: string;
  }): Promise<{
    status: boolean;
    data: QuestionWithContest[];
    total: number;
  }> => {
    const response = await api.get('/api/questions', { params });
    return response.data;
  },

  getByContest: async (contestId: string): Promise<Question[]> => {
    const response = await api.get(`/api/questions/contest/${contestId}`);
    return response.data.data || [];
  },

  create: async (contestId: string, data: CreateQuestionData): Promise<Question> => {
    const response = await api.post(`/api/questions/contest/${contestId}`, data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateQuestionData>): Promise<Question> => {
    const response = await api.put(`/api/questions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/questions/${id}`);
  },
};

// FunFact API
export interface FunFact {
  id: string;
  title: string;
  description: string;
  imagePath: string | null;
  imageUrl?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  questionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FunFactQuestion {
  id: string;
  funFactId: string;
  question: string;
  type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media: string | null;
  options: (string | { text?: string })[]; // ✅ FIXED
  correctOption: string;
  order: number;
}


export interface CreateFunFactData {
  title: string;
  description?: string;
  imagePath?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface FunFactQuestionWithFunFact extends FunFactQuestion {
  funFact?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

export const funfactsApi = {
  getAll: async (status?: 'ACTIVE' | 'INACTIVE'): Promise<{ status: boolean; data: FunFact[] }> => {
    const params = status ? { status } : {};
    const response = await api.get('/api/funfacts', { params });
    return response.data;
  },
  
  getAllQuestions: async (params?: {
    type?: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
    search?: string;
  }): Promise<FunFactQuestionWithFunFact[]> => {
    const response = await api.get('/api/funfacts/questions/all', { params });
    return response.data.data || [];
  },
  
  createQuestionStandalone: async (data: {
    funFactId?: string;
    question: string;
    type?: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
    media?: string;
    options: string[];
    correctOption: string;
    order?: number;
  }): Promise<FunFactQuestion> => {
    const response = await api.post('/api/funfacts/questions/create', data);
    return response.data;
  },

  getById: async (id: string): Promise<{ status: boolean; data: FunFact }> => {
    const response = await api.get(`/api/funfacts/${id}`);
    return response.data;
  },

  create: async (data: CreateFunFactData): Promise<FunFact> => {
    const response = await api.post('/api/funfacts', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateFunFactData>): Promise<FunFact> => {
    const response = await api.put(`/api/funfacts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/funfacts/${id}`);
  },

  getQuestions: async (funfactId: string): Promise<FunFactQuestion[]> => {
    const response = await api.get(`/api/funfacts/${funfactId}/questions`);
    return response.data.data || [];
  },

  createQuestion: async (funfactId: string, data: CreateQuestionData): Promise<FunFactQuestion> => {
    const response = await api.post(`/api/funfacts/${funfactId}/questions`, data);
    return response.data;
  },

  updateQuestion: async (id: string, data: Partial<CreateQuestionData>): Promise<FunFactQuestion> => {
    const response = await api.put(`/api/funfacts/questions/${id}`, data);
    return response.data;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await api.delete(`/api/funfacts/questions/${id}`);
  },
};

// Analytics API
export interface AnalyticsData {
  totalUsers: number;
  registeredUsers: number;
  unregisteredUsers: number;
  totalVisitors: number;
  totalGames: number;
  contestAttempted: number;
  timeRange?: string;
  visitorGrowth: {
    labels: string[];
    data: number[];
    dailyData: number[];
  };
  deviceDistribution: {
    mobile: number;
    tablet: number;
    desktop: number;
    unknown: number;
  };
  osDistribution: Array<{
    os: string;
    count: number;
  }>;
  browserDistribution: Array<{
    browser: string;
    count: number;
  }>;
}

// Visitor IP API
export interface VisitorIP {
  id: string;
  ipAddress: string;
  visitCount: number;
  clickCount: number;
  lastSessionClicks: number;
  lastVisitedPage: string | null;
  exitPage: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  screenResolution: string | null;
  lastSessionStart: string | null;
  firstVisit: string;
  lastVisit: string;
  updatedAt: string;
  // Header tracking fields
  cfConnectingIp?: string | null;
  cfIpCountry?: string | null;
  origin?: string | null;
  referer?: string | null;
  secChUa?: string | null;
  secChUaFullVersionList?: string | null;
  secChUaPlatform?: string | null;
  userAgent?: string | null;
  xRealIp?: string | null;
  xRequestedWith?: string | null;
  timeStamp?: string | null;
}

export interface VisitorsResponse {
  status: boolean;
  data: VisitorIP[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VisitorStats {
  status: boolean;
  totalVisitors: number;
  totalVisits: number;
  totalClicks: number;
  uniqueCountries: number;
}

export interface Country {
  country: string;
  countryCode: string;
}

export interface TrafficSources {
  byOrigin: Array<{ origin: string; visitorCount: number }>;
  byReferer: Array<{ referer: string; visitorCount: number }>;
  browserType: {
    webview: number;
    normalBrowser: number;
    unknown: number;
  };
}

export const visitorsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    region?: string;
    deviceType?: string;
    os?: string;
    browser?: string;
    origins?: string[];
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<VisitorsResponse> => {
    const { origins, ...rest } = params || {};
    // Send origins as comma-separated string so backend receives a single param (avoids array serialization issues)
    const paramsSerialized =
      origins?.length ? { ...rest, origins: origins.join(',') } : rest;
    const response = await api.get('/api/visitors', { params: paramsSerialized });
    return response.data;
  },
  
  getStats: async (): Promise<VisitorStats> => {
    const response = await api.get('/api/visitors/stats');
    return response.data;
  },
  
  getCountries: async (): Promise<{ status: boolean; countries: Country[] }> => {
    const response = await api.get('/api/visitors/countries');
    return response.data;
  },
  
  getTrafficSources: async (): Promise<{ status: boolean; trafficSources: TrafficSources }> => {
    const response = await api.get('/api/visitors/traffic-sources');
    return response.data;
  },
  
  exportCSV: async (): Promise<Blob> => {
    const response = await api.get('/api/visitors/export', {
      responseType: 'blob',
    });
    return response.data;
  },
  
  delete: async (ipAddress: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/visitors/${encodeURIComponent(ipAddress)}`);
    return response.data;
  },
  
  clearAll: async (): Promise<{ status: boolean; message: string; deletedCount: number }> => {
    const response = await api.delete('/api/visitors');
    return response.data;
  },
  
  getAnalytics: async (timeFilter: string): Promise<{ 
    status: boolean; 
    data: {
      byOrigin: Array<{ source: string; count: number; percentage: number }>;
      byReferer: Array<{ source: string; count: number; percentage: number }>;
      bySubdomain: Array<{ source: string; count: number; percentage: number }>;
      browserType: { webview: number; normalBrowser: number; unknown: number };
      totalVisitors: number;
    }
  }> => {
    const response = await api.get('/api/visitors/analytics', { params: { timeFilter } });
    return response.data;
  },

  getAnalyticsFull: async (params?: {
    startDate?: string;
    endDate?: string;
    countries?: string[];
    origins?: string[];
  }): Promise<{
    status: boolean;
    data: {
      newUsers: number;
      activeUsers: number;
      totalUsers: number;
      bounceRate: number;
      avgSessionDuration: number;
      avgPageViews: number;
      viewsPerSession: number;
      browserDistribution: Array<{ browser: string; count: number }>;
      deviceDistribution: Array<{ device: string; count: number }>;
      osDistribution: Array<{ os: string; count: number }>;
      tableData: Array<{
        hostname: string;
        deviceCategory: string;
        totalUsers: number;
        newUsers: number;
        bounceRate: number;
        avgSessionDuration: number;
        totalUsersPercent: number;
      }>;
    };
  }> => {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.countries?.length) queryParams.countries = params.countries.join(',');
    if (params?.origins?.length) queryParams.origins = params.origins.join(',');
    const response = await api.get('/api/visitors/analytics/full', { params: queryParams });
    return response.data;
  },
};

export const analyticsApi = {
  getAnalytics: async (timeRange?: string): Promise<AnalyticsData> => {
    const params = timeRange ? { timeRange } : {};
    const response = await api.get('/api/analytics', { params });
    return response.data;
  },
};

// Users API
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
  picture?: string | null;
  googleId?: string;
  coins?: number;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfile | null;
}

export interface UsersResponse {
  status: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const usersApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<UsersResponse> => {
    const queryParams: any = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    
    const response = await api.get('/api/users/admin/all', { params: queryParams });
    return response.data;
  },
};

// Gallery image interface (exported early for TypeScript build)
export interface GalleryImage {
  path: string;
  url: string;
  type: string;
  filename: string;
  size: number;
  modified: Date;
}

// Wheel API
export interface WheelPrize {
  label: string;
  value: number;
  probability: number;
  color?: string;
}

export interface Wheel {
  id: string;
  name: string;
  isActive: boolean;
  spinCost: number;
  prizes: WheelPrize[];
  createdAt: string;
  updatedAt: string;
}

export const wheelApi = {
  getAll: async (): Promise<{ status: boolean; data: Wheel[] }> => {
    const response = await api.get('/api/admin/wheels');
    return response.data;
  },
  
  create: async (data: {
    name: string;
    isActive: boolean;
    spinCost: number;
    prizes: WheelPrize[];
  }): Promise<{ status: boolean; message: string; data: Wheel }> => {
    const response = await api.post('/api/admin/wheels', data);
    return response.data;
  },
  
  update: async (id: string, data: {
    name?: string;
    isActive?: boolean;
    spinCost?: number;
    prizes?: WheelPrize[];
  }): Promise<{ status: boolean; message: string; data: Wheel }> => {
    const response = await api.put(`/api/admin/wheels/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/admin/wheels/${id}`);
    return response.data;
  },
};

// Upload API
export const uploadApi = {
  uploadImage: async (file: File, type: 'categories' | 'contests' | 'questions' | 'funfacts' | 'battles'): Promise<{ filename: string; path: string; url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);
    
    try {
      console.log('Uploading image to:', `/api/upload/image?type=${type}`);
      const response = await api.post(`/api/upload/image?type=${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  },
  
  getGallery: async (): Promise<{ images: GalleryImage[] }> => {
    try {
      const response = await api.get('/api/upload/gallery');
      return response.data;
    } catch (error: any) {
      console.error('Get gallery error:', error);
      throw error;
    }
  },
  
  deleteImage: async (imagePath: string): Promise<{ message: string; path: string }> => {
    try {
      // Encode the path to handle special characters
      const encodedPath = encodeURIComponent(imagePath);
      const response = await api.delete(`/api/upload/gallery/${encodedPath}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete image error:', error);
      throw error;
    }
  },
};

// Two Questions API (for intro page)
export interface TwoQuestion {
  id: string;
  question: string;
  type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media: string | null;
  options: string[];
  correctOption: string;
  status: 'ACTIVE' | 'INACTIVE';
  region?: 'IND' | 'ALL'; // Legacy
  countries?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTwoQuestionData {
  question: string;
  type?: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media?: string;
  options: string[];
  correctOption: string;
  status?: 'ACTIVE' | 'INACTIVE';
  region?: 'IND' | 'ALL';
  countries?: string[];
}

export interface TwoQuestionsResponse {
  status: boolean;
  data: TwoQuestion[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const twoQuestionsApi = {
  getAll: async (params?: {
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TwoQuestionsResponse> => {
    const queryParams: any = {};
    if (params?.status && params.status !== 'ALL') {
      queryParams.status = params.status;
    }
    if (params?.search) {
      queryParams.search = params.search;
    }
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.limit) {
      queryParams.limit = params.limit;
    }
    const response = await api.get('/api/two-questions', { params: queryParams });
    return response.data;
  },

  getById: async (id: string): Promise<{ status: boolean; data: TwoQuestion }> => {
    const response = await api.get(`/api/two-questions/${id}`);
    return response.data;
  },

  create: async (data: CreateTwoQuestionData): Promise<{ status: boolean; data: TwoQuestion }> => {
    const response = await api.post('/api/two-questions', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateTwoQuestionData>): Promise<{ status: boolean; data: TwoQuestion }> => {
    const response = await api.put(`/api/two-questions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/two-questions/${id}`);
    return response.data;
  },

  deleteMany: async (ids: string[]): Promise<{ status: boolean; message: string }> => {
    const response = await api.post('/api/two-questions/delete-many', { ids });
    return response.data;
  },
};

// Battle API
export interface Battle {
  id: string;
  name: string;
  description: string | null;
  imagePath: string;
  imageUrl?: string;
  backgroundColorTop?: string | null;
  backgroundColorBottom?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  questions?: BattleQuestion[];
}

export interface BattleQuestion {
  id: string;
  battleId: string;
  category: string;
  question: string;
  type: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media: string | null;
  options: string[] | string; // Can be array or JSON string
  correctOption: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBattleData {
  name: string;
  description?: string;
  imagePath: string;
  backgroundColorTop?: string | null;
  backgroundColorBottom?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CreateBattleQuestionData {
  category: string;
  question: string;
  type?: 'NONE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  media?: string;
  options: string[];
  correctOption: string;
  order?: number;
}

export const battlesApi = {
  getAll: async (): Promise<Battle[]> => {
    const response = await api.get('/api/battles/admin');
    return response.data;
  },
  
  getById: async (id: string): Promise<Battle> => {
    const response = await api.get(`/api/battles/${id}/admin`);
    return response.data;
  },

  create: async (data: CreateBattleData): Promise<Battle> => {
    const response = await api.post('/api/battles', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateBattleData>): Promise<Battle> => {
    const response = await api.put(`/api/battles/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/battles/${id}`);
  },

  // Battle Questions
  getQuestions: async (battleId: string): Promise<BattleQuestion[]> => {
    const response = await api.get(`/api/battles/${battleId}/questions/admin`);
    return response.data;
  },

  getQuestion: async (battleId: string, questionId: string): Promise<BattleQuestion> => {
    const response = await api.get(`/api/battles/${battleId}/questions/${questionId}`);
    return response.data;
  },

  createQuestion: async (battleId: string, data: CreateBattleQuestionData): Promise<BattleQuestion> => {
    const response = await api.post(`/api/battles/${battleId}/questions`, data);
    return response.data;
  },

  updateQuestion: async (battleId: string, questionId: string, data: Partial<CreateBattleQuestionData>): Promise<BattleQuestion> => {
    const response = await api.put(`/api/battles/${battleId}/questions/${questionId}`, data);
    return response.data;
  },

  deleteQuestion: async (battleId: string, questionId: string): Promise<void> => {
    await api.delete(`/api/battles/${battleId}/questions/${questionId}`);
  },
};

// AdSense API
export interface AdSenseAccount {
  name: string;
  publisherId: string;
  state: string;
  timeZone: string;
}

export interface AdSenseReportRow {
  DATE?: string;
  COUNTRY?: string;
  AD_UNIT_NAME?: string;
  ESTIMATED_EARNINGS: number;
  PAGE_VIEWS: number;
  CLICKS: number;
  IMPRESSIONS: number;
  PAGE_VIEWS_CTR: number;
  COST_PER_CLICK: number;
  PAGE_VIEWS_RPM: number;
}

export interface AdSenseReport {
  rows: AdSenseReportRow[];
  totalRows: number;
}

export interface AdSenseMetric {
  value: number;
  delta: number;
}

export interface AdSenseSummary {
  period: string;
  startDate: string;
  endDate: string;
  earnings: AdSenseMetric;
  pageViews: AdSenseMetric;
  clicks: AdSenseMetric;
  impressions: AdSenseMetric;
  ctr: AdSenseMetric;
  rpm: AdSenseMetric;
}

export interface AdSenseAdUnit {
  name: string;
  type: string;
  state: string;
  earnings: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

export interface AdSensePayment {
  date: string;
  amount: string;
}

export interface AdSenseSite {
  domain: string;
  state: string;
  autoAdsEnabled: boolean;
}

export interface AdSenseDetailedRow {
  DATE: string;
  COUNTRY_NAME: string;
  DOMAIN_NAME: string;
  ESTIMATED_EARNINGS: number;
  PAGE_VIEWS: number;
  PAGE_VIEWS_RPM: number;
  IMPRESSIONS: number;
  IMPRESSIONS_RPM: number;
  CLICKS: number;
}

export interface AdSenseDetailedTotals {
  earnings: number;
  pageViews: number;
  impressions: number;
  clicks: number;
  avgPageViewsRpm: number;
  avgImpressionsRpm: number;
}

export interface AdSenseDetailedReport {
  rows: AdSenseDetailedRow[];
  domains: string[];
  countries: string[];
  totals: AdSenseDetailedTotals;
  lastFetched: string;
  complete: boolean;
  missingDates?: string[];
}

export interface AdSenseSyncStatus {
  lastSynced: string | null;
  nextSync: string | null;
  status: 'idle' | 'syncing' | 'error';
  rowsCount: number;
}

// Invoice Request Types
export interface InvoiceRequest {
  id: string;
  adminId: string;
  adminUsername: string;
  monthKey: string;
  monthName: string;
  carryforward: number;
  grossEarnings: number;
  deductions: number;
  netEarnings: number;
  totalUSD: number;
  totalINR: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionNote?: string | null;
  filePath?: string | null;
  requestedAt: string;
  processedAt?: string | null;
  processedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceRequestData {
  monthKey: string;
  monthName: string;
  carryforward: number;
  grossEarnings: number;
  deductions: number;
  netEarnings: number;
  totalUSD: number;
  totalINR: number;
}

export interface OverviewPeriod {
  earnings: number;
  delta: number;
  pageViews: number;
  impressions: number;
  clicks: number;
}

export interface OverviewData {
  today: OverviewPeriod;
  yesterday: OverviewPeriod;
  last7Days: OverviewPeriod;
  thisMonth: OverviewPeriod;
  lastMonth: OverviewPeriod;
  lastSynced: string | null;
}

export interface AdminAdSenseSummary {
  adminId: string;
  username: string;
  earnings: number;
  impressions: number;
  impressionsRpm: number;
  domains: string[];
  isActive: boolean;
}

export const adsenseApi = {
  getOverview: async (): Promise<OverviewData> => {
    const response = await api.get('/api/adsense/overview');
    return response.data;
  },

  getAccount: async (): Promise<AdSenseAccount> => {
    const response = await api.get('/api/adsense/account');
    return response.data;
  },

  getReport: async (params?: {
    startDate?: string;
    endDate?: string;
    dimension?: string;
  }): Promise<AdSenseReport> => {
    const response = await api.get('/api/adsense/report', { params });
    return response.data;
  },

  getSummary: async (period?: string): Promise<AdSenseSummary> => {
    const response = await api.get('/api/adsense/report/summary', { params: { period } });
    return response.data;
  },

  getAdUnits: async (): Promise<AdSenseAdUnit[]> => {
    const response = await api.get('/api/adsense/adunits');
    return response.data;
  },

  getPayments: async (): Promise<AdSensePayment[]> => {
    const response = await api.get('/api/adsense/payments');
    return response.data;
  },

  getSites: async (): Promise<AdSenseSite[]> => {
    const response = await api.get('/api/adsense/sites');
    return response.data;
  },

  getDetailedReport: async (startDate: string, endDate: string): Promise<AdSenseDetailedReport> => {
    const response = await api.get('/api/adsense/report/detailed', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  fetchDetailedReport: async (startDate: string, endDate: string): Promise<AdSenseDetailedReport> => {
    const response = await api.post('/api/adsense/report/detailed/fetch', { startDate, endDate });
    return response.data;
  },

  getDomains: async (): Promise<{ status: boolean; domains: string[] }> => {
    const response = await api.get('/api/adsense/domains');
    return response.data;
  },

  getCountries: async (): Promise<{ status: boolean; countries: string[] }> => {
    const response = await api.get('/api/adsense/countries');
    return response.data;
  },

  getSyncStatus: async (): Promise<AdSenseSyncStatus> => {
    const response = await api.get('/api/adsense/sync-status');
    return response.data;
  },

  triggerSync: async (): Promise<{ status: boolean; message: string }> => {
    const response = await api.post('/api/adsense/sync');
    return response.data;
  },

  exportData: async (startDate: string, endDate: string): Promise<Blob> => {
    const response = await api.get('/api/adsense/export', {
      params: { startDate, endDate },
      responseType: 'blob',
    });
    return response.data;
  },

  // Monthly earnings from local DB (no Google API)
  getMonthlyEarnings: async (): Promise<{
    status: boolean;
    data: Array<{
      monthKey: string;
      monthName: string;
      earnings: number;
      status: string;
      invoiceId: string | null;
    }>;
    carryforward: number;
    revenueShare: number;
  }> => {
    const response = await api.get('/api/adsense/monthly-earnings');
    return response.data;
  },

  // Invoice Request APIs
  getInvoices: async (): Promise<{ status: boolean; data: InvoiceRequest[] }> => {
    const response = await api.get('/api/adsense/invoices');
    return response.data;
  },

  createInvoice: async (data: CreateInvoiceRequestData, file?: File): Promise<{ status: boolean; data: InvoiceRequest }> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    if (file) formData.append('file', file);
    const response = await api.post('/api/adsense/invoices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateInvoiceStatus: async (id: string, status: 'pending' | 'approved' | 'rejected', rejectionNote?: string): Promise<{ status: boolean; data: InvoiceRequest }> => {
    const response = await api.put(`/api/adsense/invoices/${id}`, { status, rejectionNote });
    return response.data;
  },

  deleteInvoice: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/adsense/invoices/${id}`);
    return response.data;
  },

  getApprovedInvoices: async (): Promise<{ status: boolean; data: InvoiceRequest[] }> => {
    const response = await api.get('/api/adsense/invoices/approved');
    return response.data;
  },

  getAdminSummary: async (): Promise<{ status: boolean; data: AdminAdSenseSummary[] }> => {
    const response = await api.get('/api/adsense/admin-summary');
    return response.data;
  },

  getInvoiceFileUrl: (id: string) => `${API_URL}/api/adsense/invoices/file/${id}`,
};

// App Settings API
export interface AppSettings {
  id: string;
  revenueDeductPercent: number;
  updatedAt: string;
}

export const appSettingsApi = {
  get: async (): Promise<{ status: boolean; data: AppSettings }> => {
    const response = await api.get('/api/app-settings');
    return response.data;
  },

  update: async (data: { revenueDeductPercent: number }): Promise<{ status: boolean; data: AppSettings }> => {
    const response = await api.put('/api/app-settings', data);
    return response.data;
  },
};

// Contact Message API
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export const contactMessagesApi = {
  getAll: async (): Promise<{ status: boolean; data: ContactMessage[] }> => {
    const response = await api.get('/api/admin/contact-messages');
    return response.data;
  },
  
  markAsRead: async (id: string): Promise<{ status: boolean; data: ContactMessage }> => {
    const response = await api.put(`/api/admin/contact-messages/${id}/read`);
    return response.data;
  },
  
  delete: async (id: string): Promise<{ status: boolean; message: string }> => {
    const response = await api.delete(`/api/admin/contact-messages/${id}`);
    return response.data;
  },
  
  deleteAll: async (): Promise<{ status: boolean; message: string; count: number }> => {
    const response = await api.delete('/api/admin/contact-messages');
    return response.data;
  },
};
