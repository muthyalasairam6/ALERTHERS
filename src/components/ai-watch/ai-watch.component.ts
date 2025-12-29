import { Component, ChangeDetectionStrategy, output, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioMonitoringService } from '../../services/audio-monitoring.service';
import { AiSettingsService, Sensitivity } from '../../services/ai-settings.service';
import { RiskAnalysisResult, RiskLevel } from '../../services/gemini.service';
import { LocationService } from '../../services/location.service';
import { ContactService } from '../../services/contact.service';

@Component({
  selector: 'app-ai-watch',
  templateUrl: './ai-watch.component.html',
  imports: [CommonModule],
})
export class AiWatchComponent implements OnDestroy {
  changeView = output<'home'>();
  
  audioMonitoringService = inject(AudioMonitoringService);
  aiSettingsService = inject(AiSettingsService);
  locationService = inject(LocationService);
  contactService = inject(ContactService);

  isMonitoring = this.audioMonitoringService.isMonitoring;
  permissionState = this.audioMonitoringService.permissionState;

  // Manual Recording State
  manualRecordingState = signal<'idle' | 'recording' | 'recorded'>('idle');
  private manualRecordTimeout: any;

  // AI Risk Alert State
  isRiskAlertShowing = signal(false);
  riskReason = signal('');
  alertCountdown = signal(10);
  private countdownInterval: any;
  
  // SOS logic
  isSosConfirmationShowing = signal(false);
  isAlertSent = signal(false);
  sosTarget = signal('');
  sosCountdown = signal(5);
  private sosCountdownInterval: any;
  private sosActionTimeout: any;

  constructor() {
    this.startMonitoring();
  }
  
  ngOnDestroy() {
    this.audioMonitoringService.stopMonitoring();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.cancelSos();
    this.discardManualRecord();
  }

  startMonitoring() {
    if (this.isMonitoring()) return;
    this.audioMonitoringService.startMonitoring((result: RiskAnalysisResult) => {
      this.handleRiskDetection(result);
    });
  }

  stopMonitoring() {
    this.audioMonitoringService.stopMonitoring();
    this.discardManualRecord();
    this.changeView.emit('home');
  }
  
  handleRiskDetection(result: RiskAnalysisResult) {
    const currentSensitivity = this.aiSettingsService.sensitivity();

    const riskLevels: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
    const sensitivityThresholds: Record<Sensitivity, number> = { high: 1, medium: 2, low: 3 };

    const detectedRiskValue = riskLevels[result.riskLevel];
    const userThreshold = sensitivityThresholds[currentSensitivity];
    
    if (detectedRiskValue >= userThreshold) {
      this.riskReason.set(result.reason);
      this.isRiskAlertShowing.set(true);
      this.startAlertCountdown();
    }
  }

  startAlertCountdown() {
    this.alertCountdown.set(10);
    this.countdownInterval = setInterval(() => {
      this.alertCountdown.update(c => c - 1);
      if (this.alertCountdown() <= 0) {
        clearInterval(this.countdownInterval);
        this.confirmSosFromAlert();
      }
    }, 1000);
  }
  
  dismissRiskAlert() {
    this.isRiskAlertShowing.set(false);
    clearInterval(this.countdownInterval);
    this.startMonitoring();
  }

  confirmSosFromAlert() {
    this.isRiskAlertShowing.set(false);
    clearInterval(this.countdownInterval);
    this.sosActivated();
  }
  
  sosActivated() {
    if (this.contactService.contacts().length > 0) {
        this.sosTarget.set('Your Emergency Contacts');
    } else {
        this.sosTarget.set('Emergency Services (911)');
    }
    
    this.isAlertSent.set(true);
    this.sosCountdown.set(5);

    this.sosCountdownInterval = setInterval(() => {
      this.sosCountdown.update(c => c - 1);
    }, 1000);

    this.sosActionTimeout = setTimeout(() => {
      clearInterval(this.sosCountdownInterval);
      this.isAlertSent.set(false);
      
      if (this.contactService.contacts().length > 0) {
        this.sendMultiContactAlert();
      } else {
        window.location.href = `tel:911`;
      }
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
      this.manualRecordingState.set('idle'); // Reset UI
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
    this.changeView.emit('home');
  }

  // --- Manual Recording Methods ---
  startManualRecord() {
    if (this.manualRecordingState() !== 'idle' || !this.isMonitoring()) return;

    this.audioMonitoringService.startManualRecording();
    this.manualRecordingState.set('recording');

    // Set a max recording duration of 10 seconds
    this.manualRecordTimeout = setTimeout(() => {
      if (this.manualRecordingState() === 'recording') {
        this.stopManualRecord();
      }
    }, 10000);
  }

  stopManualRecord() {
    if (this.manualRecordingState() !== 'recording') return;

    clearTimeout(this.manualRecordTimeout);
    this.audioMonitoringService.stopManualRecording();
    this.manualRecordingState.set('recorded');
  }

  discardManualRecord() {
    this.audioMonitoringService.clearManualRecordingClip();
    this.manualRecordingState.set('idle');
  }
}
