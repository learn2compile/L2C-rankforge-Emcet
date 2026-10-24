import { authGuard } from './core/guards/auth.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/landing-page/landing-page').then((m) => m.Home), title: 'RankForge | EAMCET 2027 Preparation' },
  { path: 'auth', pathMatch: 'full', redirectTo: 'auth/login' },
  { path: 'auth/login', data: { mode: 'login' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Sign in | RankForge' },
  { path: 'auth/register', data: { mode: 'register' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Create account | RankForge' },
  { path: 'auth/forgot-password', data: { mode: 'forgot' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Reset password | RankForge' },
  { path: 'auth/reset-password', data: { mode: 'reset' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Choose a new password | RankForge' },
  { path: 'auth/otp', data: { mode: 'otp' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Verify OTP | RankForge' },
  { path: 'auth/verify-email', data: { mode: 'verify' }, loadComponent: () => import('./features/auth/pages/auth-page').then((m) => m.AuthPage), title: 'Verify email | RankForge' },
  { path: 'home', canActivate: [authGuard], loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard), title: 'Your study dashboard | RankForge' },
  { path: 'study-plan', canActivate: [authGuard], data: { screen: 'study-plan' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Study plan | RankForge' },
  { path: 'subjects', canActivate: [authGuard], data: { screen: 'subjects' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Subjects | RankForge' },
  { path: 'practice', canActivate: [authGuard], data: { screen: 'practice' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Practice questions | RankForge' },
  { path: 'mock-tests', canActivate: [authGuard], data: { screen: 'mock-tests' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Mock tests | RankForge' },
  { path: 'revision', canActivate: [authGuard], data: { screen: 'revision' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Revision list | RankForge' },
  { path: 'analytics', canActivate: [authGuard], data: { screen: 'analytics' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Analytics | RankForge' },
  { path: 'notifications', canActivate: [authGuard], data: { screen: 'notifications' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Notifications | RankForge' },
  { path: 'profile', canActivate: [authGuard], data: { screen: 'profile' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Profile | RankForge' },
  { path: 'settings', canActivate: [authGuard], data: { screen: 'settings' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Settings | RankForge' },
  { path: 'help', canActivate: [authGuard], data: { screen: 'help' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Help | RankForge' },
  { path: 'feedback', canActivate: [authGuard], data: { screen: 'feedback' }, loadComponent: () => import('./features/workspace/workspace-page').then((m) => m.WorkspacePage), title: 'Feedback | RankForge' },
  { path: '**', redirectTo: '' },
];
