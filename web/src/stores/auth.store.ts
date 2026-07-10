import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, userApi } from '../services/api';

interface User {
  id: number;
  openid: string;
  nickname: string;
  avatar: string;
  plan_type: string | null;
  is_member: number;
  tokens_remaining: number;
  is_admin: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  showLoginModal: boolean;

  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setShowLoginModal: (v: boolean) => void;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoggedIn: false,
      showLoginModal: false,

      setToken: (token) => {
        localStorage.setItem('access_token', token);
        set({ token, isLoggedIn: true });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem('access_token');
        // 退出时清除上次会话记录，避免不同用户共用设备时交叉显示
        localStorage.removeItem('last_conv_id');
        set({ token: null, user: null, isLoggedIn: false });
      },

      setShowLoginModal: (v) => set({ showLoginModal: v }),

      fetchProfile: async () => {
        try {
          const user = await userApi.getProfile() as any;
          set({ user });
        } catch (err: any) {
          // 仅 401（Token 失效）时才登出；网络抖动/服务器错误时静默保留现有登录态
          // 注：axios 拦截器已对 401 全局派发 auth:logout 事件，此处仅作兜底处理
          const status = err?.status ?? err?.statusCode ?? err?.response?.status;
          if (status === 401) {
            get().logout();
          }
          // 其他错误：静默忽略，用户保持登录状态不受影响
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ token: state.token, user: state.user, isLoggedIn: state.isLoggedIn }),
    },
  ),
);
