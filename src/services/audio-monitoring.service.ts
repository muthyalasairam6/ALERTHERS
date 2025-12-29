import { Injectable, signal } from '@angular/core';
import { GeminiService, RiskAnalysisResult } from './gemini.service';

type PermissionState = 'prompt' | 'granted' | 'denied';

@Injectable({
  providedIn: 'root',
})
export class AudioMonitoringService {
  isMonitoring = signal(false);
  permissionState = signal<PermissionState>('prompt');
  
  // New properties for manual recording
  isManuallyRecording = signal(false);
  manualRecordingClip = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private intervalId: any;
  private onRiskDetectedCallback: ((result: RiskAnalysisResult) => void) | null = null;

  constructor(private geminiService: GeminiService) {}

  async startMonitoring(onRiskDetected: (result: RiskAnalysisResult) => void): Promise<void> {
    if (this.isMonitoring()) return;
    this.onRiskDetectedCallback = onRiskDetected;

    try {
      // Initialize stream and recorder only if they don't exist
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.permissionState.set('granted');
      
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };
      }
      
      this.isMonitoring.set(true);

      // Start the interval for automated analysis
      this.startAutoMonitoringInterval(this.onRiskDetectedCallback);

      if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
        this.mediaRecorder.start();
      }

    } catch (err) {
      console.error('Error accessing microphone:', err);
      this.permissionState.set('denied');
      this.isMonitoring.set(false);
    }
  }

  stopMonitoring(): void {
    if (!this.isMonitoring()) return;
    this.onRiskDetectedCallback = null;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach(track => track.stop());
    
    this.isMonitoring.set(false);
    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.clearManualRecordingClip();
  }
  
  private startAutoMonitoringInterval(onRiskDetected: (result: RiskAnalysisResult) => void): void {
      if (this.intervalId) clearInterval(this.intervalId); // Ensure no multiple intervals
      this.intervalId = setInterval(() => {
        if (this.mediaRecorder?.state === 'recording') {
            this.mediaRecorder.stop();
            this.mediaRecorder.start();
        }
        if (this.audioChunks.length > 0) {
            this.processAutoAudio(onRiskDetected);
        }
      }, 5000);
  }

  private async processAutoAudio(onRiskDetected: (result: RiskAnalysisResult) => void): Promise<void> {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = []; // Clear chunks for the next interval

    if (audioBlob.size === 0) return;

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(',')[1];
      const result = await this.geminiService.analyzeAudioForRisk(base64Audio);
      
      console.log('AI Analysis:', result);
      if (result.riskLevel !== 'none') {
        onRiskDetected(result);
        this.stopMonitoring(); // Stop after detecting a threat to show the alert
      }
    };
  }

  // --- Manual Recording Methods ---

  async startManualRecording(): Promise<void> {
    if (!this.stream || this.isManuallyRecording()) return;
    
    // Pause auto-monitoring
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.isManuallyRecording.set(true);
    this.manualRecordingClip.set(null);
    this.audioChunks = [];
    
    // Restart the recorder for a clean take
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop(); 
    }
    this.mediaRecorder?.start();
  }

  stopManualRecording(): void {
    if (!this.isManuallyRecording()) return;
    
    this.isManuallyRecording.set(false);
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.audioChunks.length > 0) {
      this.processManualAudio();
    }

    // Restart auto-monitoring if it was active
    if (this.isMonitoring() && this.onRiskDetectedCallback) {
      this.mediaRecorder?.start();
      this.startAutoMonitoringInterval(this.onRiskDetectedCallback);
    }
  }

  private processManualAudio(): void {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    if (audioBlob.size === 0) return;

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = (reader.result as string).split(',')[1];
      this.manualRecordingClip.set(base64Audio);
    };
  }

  clearManualRecordingClip(): void {
    this.manualRecordingClip.set(null);
  }
}
