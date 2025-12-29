import { Component, ChangeDetectionStrategy, output, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FakeCallService, FakeCallSettings } from '../../services/fake-call.service';

@Component({
  selector: 'app-fake-call',
  templateUrl: './fake-call.component.html',
  imports: [CommonModule],
})
export class FakeCallComponent implements OnInit, OnDestroy {
  changeView = output<void>();
  fakeCallService = inject(FakeCallService);

  private ringtone: HTMLAudioElement | null = null;
  private callTimerInterval: any;
  private timeInterval: any;

  settings = signal<FakeCallSettings>({ callerName: 'Mom', callerNumber: '', message: '' });
  callState = signal<'incoming' | 'active'>('incoming');
  callDuration = signal(0);
  currentTime = signal('');
  
  ngOnInit() {
    this.settings.set(this.fakeCallService.getSettings());
    this.playRingtone();
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000 * 30); // Update time every 30 seconds
  }

  ngOnDestroy() {
    this.stopRingtone();
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  updateTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.currentTime.set(`${hours}:${minutes}`);
  }

  playRingtone() {
    this.ringtone = new Audio('https://cdn.pixabay.com/audio/2022/08/22/audio_c480829872.mp3');
    this.ringtone.loop = true;
    this.ringtone.play().catch(error => console.error("Ringtone playback failed:", error));
  }

  stopRingtone() {
    if (this.ringtone) {
      this.ringtone.pause();
      this.ringtone.currentTime = 0;
    }
  }

  acceptCall() {
    this.stopRingtone();
    this.callState.set('active');
    this.callTimerInterval = setInterval(() => {
      this.callDuration.update(d => d + 1);
    }, 1000);
  }

  endCall() {
    this.stopRingtone();
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }
    this.changeView.emit();
  }

  formatDuration(seconds: number): string {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }
}
