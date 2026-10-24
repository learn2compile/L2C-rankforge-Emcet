import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'otp' | 'verify';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly mode = signal<AuthMode>((this.route.snapshot.data['mode'] || 'login') as AuthMode);
  readonly currentYear = new Date().getFullYear();
  readonly notice = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly token = signal('');
  readonly verificationEmail = signal('');
  readonly devCode = signal('');
  readonly oauthConfigured = signal<boolean | null>(null);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmPassword: ['', [Validators.required]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] || 'login') as AuthMode);
      this.form.reset();
      this.notice.set('');
      this.error.set('');
      this.devCode.set('');
    });
    this.route.queryParamMap.subscribe((params) => {
      this.token.set(params.get('token') || '');
      this.verificationEmail.set(params.get('email') || '');
      if (params.get('oauth') === 'failed') this.error.set('Google sign-in could not be completed. Check the provider configuration and try again.');
      if (params.get('oauth') === 'success') this.notice.set('Google sign-in completed. Loading your account…');
      if (params.get('reset') === 'success') this.notice.set('Your password has been updated. Sign in with your new password.');
      if (params.get('email')) this.form.controls.email.setValue(params.get('email') || '');
    });
  }

  get isLogin(): boolean { return this.mode() === 'login'; }
  get isRegister(): boolean { return this.mode() === 'register'; }
  get isForgot(): boolean { return this.mode() === 'forgot'; }
  get isReset(): boolean { return this.mode() === 'reset'; }
  get isOtp(): boolean { return this.mode() === 'otp'; }
  get isVerify(): boolean { return this.mode() === 'verify'; }

  async submit(): Promise<void> {
    this.notice.set('');
    this.error.set('');
    this.devCode.set('');
    const controls = this.controlsForMode();
    let invalid = false;
    for (const name of controls) {
      const control = this.form.controls[name];
      control.markAsTouched();
      if (control.invalid) invalid = true;
    }
    if (this.isReset && !this.token()) {
      this.error.set('This password-reset link is missing or expired. Request a new reset link.');
      return;
    }
    if (this.isVerify && !this.token()) {
      this.error.set('Open the verification link from your email, or request a new one below.');
      if (!this.form.controls.email.value && this.verificationEmail()) this.form.controls.email.setValue(this.verificationEmail());
      return;
    }
    if (this.isReset && this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.form.controls.confirmPassword.markAsTouched();
      this.error.set('Your passwords do not match.');
      return;
    }
    if (invalid) return;

    this.busy.set(true);
    try {
      if (this.isLogin) {
        await this.auth.login(this.form.controls.email.value, this.form.controls.password.value);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        await this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/home');
      } else if (this.isRegister) {
        const response = await this.auth.register(this.form.controls.name.value, this.form.controls.email.value, this.form.controls.password.value);
        this.verificationEmail.set(this.form.controls.email.value);
        this.notice.set(response.message);
        await this.router.navigate(['/auth/verify-email'], {
          queryParams: { email: this.form.controls.email.value, ...(response.devVerificationToken ? { token: response.devVerificationToken } : {}) },
        });
      } else if (this.isForgot) {
        const response = await this.auth.forgotPassword(this.form.controls.email.value);
        this.notice.set(response.message);
        if (response.devResetToken) {
          await this.router.navigate(['/auth/reset-password'], { queryParams: { token: response.devResetToken } });
        }
      } else if (this.isReset) {
        const response = await this.auth.resetPassword(this.token(), this.form.controls.password.value);
        this.notice.set(response.message);
        await this.router.navigate(['/auth/login'], { queryParams: { reset: 'success' } });
      } else if (this.isOtp) {
        const response = await this.auth.verifyPhoneOtp(this.form.controls.phone.value, this.form.controls.otp.value);
        this.notice.set(response.message);
        await this.router.navigateByUrl('/home');
      } else if (this.isVerify) {
        const response = await this.auth.verifyEmail(this.token());
        this.notice.set(response.message);
        await this.router.navigateByUrl('/home');
      }
    } catch (error) {
      const message = this.auth.errorMessage(error);
      if (this.isLogin && message.toLowerCase().includes('verify your email')) {
        const email = this.form.controls.email.value;
        await this.router.navigate(['/auth/verify-email'], { queryParams: { email } });
        this.notice.set(message);
      } else {
        this.error.set(message);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async startGoogleLogin(): Promise<void> {
    this.notice.set('');
    this.error.set('');
    this.busy.set(true);
    try {
      const result = await this.auth.getProviders();
      this.oauthConfigured.set(result.providers.google);
      if (!result.providers.google) {
        this.notice.set('Google sign-in is not configured yet. Add the Google OAuth client ID, secret and callback URL to the backend environment.');
        return;
      }
      if (typeof window !== 'undefined') window.location.assign(`${this.auth.apiBaseUrl}/auth/google`);
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  startPhoneOtp(): void { void this.router.navigateByUrl('/auth/otp'); }

  async sendOtp(): Promise<void> {
    const phone = this.form.controls.phone;
    phone.markAsTouched();
    this.notice.set(''); this.error.set(''); this.devCode.set('');
    if (phone.invalid) { this.error.set('Enter a valid 10-digit Indian mobile number first.'); return; }
    this.busy.set(true);
    try {
      const response = await this.auth.startPhoneOtp(phone.value);
      this.notice.set(response.message);
      this.devCode.set(response.devOtpCode || '');
    } catch (error) { this.error.set(this.auth.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  async resend(): Promise<void> {
    this.notice.set(''); this.error.set(''); this.devCode.set(''); this.busy.set(true);
    try {
      if (this.isOtp) {
        const phone = this.form.controls.phone;
        phone.markAsTouched();
        if (phone.invalid) throw new Error('Enter a valid mobile number first.');
        const response = await this.auth.startPhoneOtp(phone.value);
        this.notice.set(response.message); this.devCode.set(response.devOtpCode || '');
      } else {
        const email = this.form.controls.email.value || this.verificationEmail();
        if (!email) throw new Error('Enter the email address for your account first.');
        const response = await this.auth.resendVerification(email);
        this.notice.set(response.message);
        if (response.devVerificationToken) this.token.set(response.devVerificationToken);
      }
    } catch (error) { this.error.set(this.auth.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  private controlsForMode(): Array<'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'otp'> {
    if (this.isLogin) return ['email', 'password'];
    if (this.isRegister) return ['name', 'email', 'password'];
    if (this.isForgot) return ['email'];
    if (this.isReset) return ['password', 'confirmPassword'];
    if (this.isOtp) return ['phone', 'otp'];
    return [];
  }
}
