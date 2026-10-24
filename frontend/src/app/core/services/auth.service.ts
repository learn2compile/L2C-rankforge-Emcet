import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface RankForgeUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt?: string;
}
export interface ApiMessage {
  message: string;
  deliveryConfigured?: boolean;
  devVerificationToken?: string;
  devResetToken?: string;
  devOtpCode?: string;
}
export interface ProviderStatus { providers: { email: boolean; sms: boolean; google: boolean }; developmentCodesExposed: boolean; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<RankForgeUser | null>(null);
  readonly apiBaseUrl = API_BASE_URL;
  private restorePromise: Promise<RankForgeUser | null> | null = null;

  async restoreSession(): Promise<RankForgeUser | null> {
    if (this.user()) return this.user();
    if (!this.restorePromise) {
      this.restorePromise = this.get<{ user: RankForgeUser | null }>('/auth/session')
        .then((response) => { this.user.set(response.user); return response.user; })
        .catch(() => { this.user.set(null); return null; })
        .finally(() => { this.restorePromise = null; });
    }
    return this.restorePromise;
  }

  async login(email: string, password: string): Promise<RankForgeUser> {
    const response = await this.post<{ user: RankForgeUser }>('/auth/login', { email, password });
    this.user.set(response.user);
    return response.user;
  }

  register(name: string, email: string, password: string): Promise<ApiMessage> {
    return this.post<ApiMessage>('/auth/register', { name, email, password });
  }

  verifyEmail(token: string): Promise<{ message: string; user: RankForgeUser }> {
    return this.post<{ message: string; user: RankForgeUser }>('/auth/verify-email', { token }).then((response) => { this.user.set(response.user); return response; });
  }

  resendVerification(email: string): Promise<ApiMessage> {
    return this.post<ApiMessage>('/auth/resend-verification', { email });
  }

  forgotPassword(email: string): Promise<ApiMessage> {
    return this.post<ApiMessage>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.post<{ message: string }>('/auth/reset-password', { token, password });
  }

  startPhoneOtp(phone: string): Promise<ApiMessage> {
    return this.post<ApiMessage>('/auth/otp/start', { phone });
  }

  verifyPhoneOtp(phone: string, code: string): Promise<{ message: string; user: RankForgeUser }> {
    return this.post<{ message: string; user: RankForgeUser }>('/auth/otp/verify', { phone, code }).then((response) => { this.user.set(response.user); return response; });
  }

  getProviders(): Promise<ProviderStatus> { return this.get<ProviderStatus>('/auth/providers'); }

  async signOut(): Promise<void> {
    try { await this.post<void>('/auth/logout', {}); } finally { this.user.set(null); }
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error?.message;
      if (typeof apiMessage === 'string') return apiMessage;
      if (error.status === 0) return 'Could not connect to the RankForge API. Start the backend and check its API URL.';
      if (error.status >= 500) return 'RankForge could not complete that request. Please try again shortly.';
    }
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }

  private async get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${API_BASE_URL}${path}`, { withCredentials: true }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.get<{ csrfToken: string }>('/auth/csrf');
    return firstValueFrom(this.http.post<T>(`${API_BASE_URL}${path}`, body, { withCredentials: true }));
  }
}
