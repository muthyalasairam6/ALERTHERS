import { Component, ChangeDetectionStrategy, output, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactService } from '../../services/contact.service';
import { AudioMonitoringService } from '../../services/audio-monitoring.service';
import { LocationService } from '../../services/location.service';
import { AiSettingsService, Sensitivity } from '../../services/ai-settings.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  imports: [CommonModule],
})
export class HomeComponent implements OnDestroy {
  changeView = output<'fakeCallSettings' | 'aiWatch'>();
  contactService = inject(ContactService);
  audioMonitoringService = inject(AudioMonitoringService);
  locationService = inject(LocationService);
  aiSettingsService = inject(AiSettingsService);

  isAlertSent = signal(false);
  isSosConfirmationShowing = signal(false);
  isMonitoring = this.audioMonitoringService.isMonitoring;
  
  // AI Settings Modal
  isAiSettingsModalOpen = signal(false);

  // SOS state
  sosTarget = signal('');
  sosCountdown = signal(5);
  private sosCountdownInterval: any;
  private sosActionTimeout: any;

  // Panic Alert state
  isPanicCountdownShowing = signal(false);
  panicCountdown = signal(3);
  private panicCountdownInterval: any;
  private panicActionTimeout: any;
  
  hasEmergencyContacts = computed(() => this.contactService.contacts().length > 0);

  ngOnDestroy() {
    this.cancelSos(); // Ensure SOS timers are cleared
    this.cancelPanicAlert(); // Ensure Panic timers are cleared
  }
  
  sosActivated() {
    if (this.hasEmergencyContacts()) {
        this.sosTarget.set('Your Emergency Contacts');
    } else {
        this.sosTarget.set('Emergency Services (911)');
    }
    
    this.isAlertSent.set(true);
    this.sosCountdown.set(5); // Reset countdown

    this.sosCountdownInterval = setInterval(() => {
      this.sosCountdown.update(c => c - 1);
    }, 1000);

    this.sosActionTimeout = setTimeout(() => {
      clearInterval(this.sosCountdownInterval);
      this.isAlertSent.set(false); // Hide countdown modal
      
      this.triggerAlertAction();
    }, 5000);
  }
  
  sendMultiContactAlert() {
    const coords = this.locationService.coordinates();
    let locationInfo = "My current location is not available.";
    if (coords) {
      locationInfo = `My last known location is: https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
    }

    const subject = "SOS ALERT - I NEED HELP";
    let body = `URGENT: This is an automated SOS alert from my Aura Safety app.\n\nI am in a potential emergency and may need help.\n\n${locationInfo}\n\nPlease try to contact me immediately.`;

    if (this.audioMonitoringService.manualRecordingClip()) {
      body += "\n\nAn audio clip was recorded with this alert.";
      this.audioMonitoringService.clearManualRecordingClip();
    }

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    this.isSosConfirmationShowing.set(true);
  }

  cancelSos() {
    if (this.sosCountdownInterval) clearInterval(this.sosCountdownInterval);
    if (this.sosActionTimeout) clearTimeout(this.sosActionTimeout);
    this.isAlertSent.set(false);
  }
  
  dismissSosConfirmation() {
    this.isSosConfirmationShowing.set(false);
  }

  triggerFakeCall() {
    this.changeView.emit('fakeCallSettings');
  }

  activateSafetyWatch() {
    this.changeView.emit('aiWatch');
  }
  
  // --- Panic Alert ---
  initiatePanicAlert() {
    this.isPanicCountdownShowing.set(true);
    this.panicCountdown.set(3); // Reset countdown

    this.panicCountdownInterval = setInterval(() => {
      this.panicCountdown.update(c => c - 1);
    }, 1000);

    this.panicActionTimeout = setTimeout(() => {
      clearInterval(this.panicCountdownInterval);
      this.isPanicCountdownShowing.set(false);
      this.triggerAlertAction();
    }, 3000);
  }

  cancelPanicAlert() {
    if (this.panicCountdownInterval) clearInterval(this.panicCountdownInterval);
    if (this.panicActionTimeout) clearTimeout(this.panicActionTimeout);
    this.isPanicCountdownShowing.set(false);
  }

  private triggerAlertAction() {
     if (this.hasEmergencyContacts()) {
      this.sendMultiContactAlert();
    } else {
      window.location.href = `tel:911`;
    }
  }

  // --- AI Settings Modal ---
  openAiSettings() {
    this.isAiSettingsModalOpen.set(true);
  }

  closeAiSettings() {
    this.isAiSettingsModalOpen.set(false);
  }
  
  setSensitivity(sensitivity: Sensitivity) {
    this.aiSettingsService.updateSensitivity(sensitivity);
  }
}
