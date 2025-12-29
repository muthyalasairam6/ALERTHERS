import { Injectable, signal } from '@angular/core';

export type Sensitivity = 'low' | 'medium' | 'high';

@Injectable({
  providedIn: 'root',
})
export class AiSettingsService {
  private readonly STORAGE_KEY = 'safety_app_ai_settings';
  
  sensitivity = signal<Sensitivity>('medium');

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (['low', 'medium', 'high'].includes(settings.sensitivity)) {
          this.sensitivity.set(settings.sensitivity);
        }
      }
    } catch (e) {
      console.error('Error reading AI settings from localStorage', e);
    }
  }

  private saveSettings(): void {
    try {
      const settings = { sensitivity: this.sensitivity() };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving AI settings to localStorage', e);
    }
  }
  
  updateSensitivity(newSensitivity: Sensitivity): void {
    this.sensitivity.set(newSensitivity);
    this.saveSettings();
  }
}
