import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector: 'app-dashboard', standalone: true, imports: [RouterLink], templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
export class Dashboard {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  readonly subjects = [
    { name: 'Mathematics', short: 'M', tone: 'orange', progress: 42, done: '12 of 28 topics', next: 'Quadratic equations' },
    { name: 'Physics', short: 'P', tone: 'teal', progress: 28, done: '8 of 29 topics', next: 'Laws of motion' },
    { name: 'Chemistry', short: 'C', tone: 'gold', progress: 35, done: '10 of 28 topics', next: 'Atomic structure' },
  ];
  async signOut(): Promise<void> { try { await this.auth.signOut(); } finally { await this.router.navigateByUrl('/'); } }
  get firstName(): string { return this.auth.user()?.name?.split(' ')[0] || 'Student'; }
}
