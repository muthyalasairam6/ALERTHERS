import { Injectable, signal } from '@angular/core';

export interface FakeCallSettings {
  callerName: string;
  callerNumber: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class FakeCallService {
  private readonly STORAGE_KEY = 'safety_app_fake_call_settings';

  private defaultSettings: FakeCallSettings = {
    callerName: 'Mom',
    callerNumber: '(555) 123-4567',
    message: "Hey, I need you to come get me now, there's a situation here. Please hurry."
  };

  settings = signal<FakeCallSettings>(this.loadSettings());

  private loadSettings(): FakeCallSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : this.defaultSettings;
    } catch (e) {
      console.error('Error reading fake call settings from localStorage', e);
      return this.defaultSettings;
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings()));
    } catch (e) {
      console.error('Error saving fake call settings to localStorage', e);
    }
  }

  getSettings(): FakeCallSettings {
    return this.settings();
  }

  updateSettings(newSettings: FakeCallSettings): void {
    this.settings.set(newSettings);
    this.saveSettings();
  }
}
