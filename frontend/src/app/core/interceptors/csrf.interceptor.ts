import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { API_BASE_URL } from '../config/api.config';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const match = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  if (!match) return null;
  try { return decodeURIComponent(match.slice(prefix.length)); } catch { return match.slice(prefix.length); }
}

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const platformId = inject(PLATFORM_ID);
  if (!request.url.startsWith(API_BASE_URL)) return next(request);
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  const csrf = isPlatformBrowser(platformId) && mutating ? readCookie('rf_csrf') : null;
  const headers: Record<string, string> = {};
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return next(request.clone({ withCredentials: true, setHeaders: headers }));
};
