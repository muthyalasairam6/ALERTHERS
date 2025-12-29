import { Injectable, signal } from '@angular/core';
import { Contact } from '../models/contact.model';

@Injectable({
  providedIn: 'root',
})
export class LocationSharingService {
  private readonly SHARING_STATE_KEY = 'safety_app_sharing_state';

  isSharing = signal(false);
  sharingRecipients = signal<Contact[]>([]);

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const storedState = localStorage.getItem(this.SHARING_STATE_KEY);
      if (storedState) {
        const state = JSON.parse(storedState);
        if (state.isSharing) { // Only restore if it was an active session
          this.isSharing.set(state.isSharing);
          this.sharingRecipients.set(state.recipients || []);
        }
      }
    } catch (e) {
      console.error('Error loading sharing state from localStorage', e);
    }
  }

  private saveState(): void {
    try {
      const state = {
        isSharing: this.isSharing(),
        recipients: this.sharingRecipients(),
      };
      localStorage.setItem(this.SHARING_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving sharing state to localStorage', e);
    }
  }

  start(recipients: Contact[]): void {
    this.isSharing.set(true);
    this.sharingRecipients.set(recipients);
    this.saveState();
  }

  stop(): void {
    this.isSharing.set(false);
    this.sharingRecipients.set([]);
    this.saveState();
  }
}
