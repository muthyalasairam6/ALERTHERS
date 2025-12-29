import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, SafetyTip } from '../../services/gemini.service';

type Status = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-tips',
  templateUrl: './tips.component.html',
  imports: [CommonModule],
})
export class TipsComponent implements OnInit {
  private geminiService = inject(GeminiService);

  tips = signal<SafetyTip[]>([]);
  status = signal<Status>('loading');
  errorMessage = signal('');

  async ngOnInit(): Promise<void> {
    this.loadTips();
  }

  async loadTips() {
    this.status.set('loading');
    try {
      const fetchedTips = await this.geminiService.getSafetyTips();
      this.tips.set(fetchedTips);
      this.status.set('loaded');
    } catch (error) {
      this.status.set('error');
      if (error instanceof Error) {
        this.errorMessage.set(error.message);
      } else {
        this.errorMessage.set('An unknown error occurred.');
      }
      console.error(error);
    }
  }
}
