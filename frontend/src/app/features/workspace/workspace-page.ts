import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

 type WorkspaceKey = 'study-plan' | 'subjects' | 'practice' | 'mock-tests' | 'revision' | 'analytics' | 'notifications' | 'profile' | 'settings' | 'help' | 'feedback';

@Component({ selector: 'app-workspace-page', standalone: true, imports: [RouterLink], templateUrl: './workspace-page.html', styleUrl: './workspace-page.scss' })
export class WorkspacePage {
  private readonly route = inject(ActivatedRoute);
  readonly screen = signal<WorkspaceKey>((this.route.snapshot.data['screen'] || 'study-plan') as WorkspaceKey);
  readonly notice = signal('');
  readonly pageInfo: Record<WorkspaceKey, { eyebrow: string; title: string; description: string; icon: string }> = {
    'study-plan': { eyebrow: 'YOUR ROUTINE', title: 'Study plan', description: 'Make a realistic plan, then adjust it as you learn what works for you.', icon: '▤' },
    subjects: { eyebrow: 'YOUR SYLLABUS', title: 'Subjects & topics', description: 'Explore your core subjects and keep topic-level progress in one place.', icon: '◫' },
    practice: { eyebrow: 'BUILD UNDERSTANDING', title: 'Practice questions', description: 'Choose a subject and start a focused practice session.', icon: '◎' },
    'mock-tests': { eyebrow: 'PRACTICE YOUR PACE', title: 'Mock tests', description: 'Use timed practice to build familiarity with an exam-style session.', icon: '◷' },
    revision: { eyebrow: 'LEARN FROM YOUR ATTEMPTS', title: 'Revision list', description: 'A dedicated place for questions and concepts you want to revisit.', icon: '↻' },
    analytics: { eyebrow: 'YOUR LEARNING SIGNALS', title: 'Progress & analytics', description: 'Review practice activity and topic completion without rank guarantees.', icon: '↗' },
    notifications: { eyebrow: 'UPDATES', title: 'Notifications', description: 'Keep useful reminders and account updates together.', icon: '♧' },
    profile: { eyebrow: 'YOUR ACCOUNT', title: 'Profile', description: 'Review the account details associated with this preview session.', icon: '◉' },
    settings: { eyebrow: 'MAKE IT YOURS', title: 'Settings', description: 'Preferences and account controls for your preparation workspace.', icon: '⚙' },
    help: { eyebrow: 'HERE TO HELP', title: 'Help & support', description: 'Find guidance for using RankForge and getting unstuck.', icon: '?' },
    feedback: { eyebrow: 'HELP US IMPROVE', title: 'Share feedback', description: 'Tell us what would make your preparation workflow more useful.', icon: '✳' },
  };
  readonly subjects = [
    { name: 'Mathematics', detail: 'Algebra, trigonometry, calculus and more', tone: 'orange', letter: 'M', progress: '12 of 28 topics' },
    { name: 'Physics', detail: 'Mechanics, electricity, optics and more', tone: 'teal', letter: 'P', progress: '8 of 29 topics' },
    { name: 'Chemistry', detail: 'Physical, organic and inorganic chemistry', tone: 'gold', letter: 'C', progress: '10 of 28 topics' },
  ];
  constructor() { this.route.data.subscribe((data) => { this.screen.set((data['screen'] || 'study-plan') as WorkspaceKey); this.notice.set(''); }); }
  get info() { return this.pageInfo[this.screen()]; }
  action(message: string): void { this.notice.set(message); }
}
