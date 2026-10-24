import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-home', standalone: true, imports: [RouterLink], templateUrl: './landing-page.html', styleUrl: './landing-page.scss' })
export class Home {
  readonly currentYear = new Date().getFullYear();
  readonly features = [
    { icon: '◎', number: '01', title: 'Practice by topic', description: 'Turn big chapters into smaller, focused practice sessions that are easier to finish.' },
    { icon: '◷', number: '02', title: 'Mock tests that build rhythm', description: 'Get comfortable with timed practice and learn how to pace your attempts.' },
    { icon: '↻', number: '03', title: 'Revise what matters', description: 'Bring tricky questions and weak concepts back into your revision loop.' },
    { icon: '▤', number: '04', title: 'A plan you can follow', description: 'Organise your study time around subjects, topics and your daily availability.' },
    { icon: '↗', number: '05', title: 'See your progress clearly', description: 'Track practice and topic completion with transparent, useful learning signals.' },
    { icon: '✳', number: '06', title: 'Made for AP & Telangana', description: 'A preparation workspace focused on the EAMCET journey and its subject mix.' },
  ];
  scrollTo(id: string): void { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
