import { Component, ChangeDetectionStrategy, output, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FakeCallService, FakeCallSettings } from '../../services/fake-call.service';

@Component({
  selector: 'app-fake-call-settings',
  templateUrl: './fake-call-settings.component.html',
  imports: [CommonModule],
})
export class FakeCallSettingsComponent implements OnInit {
  changeView = output<'home' | 'fakeCall'>();
  fakeCallService = inject(FakeCallService);

  callerName = signal('');
  callerNumber = signal('');
  message = signal('');

  ngOnInit() {
    const currentSettings = this.fakeCallService.getSettings();
    this.callerName.set(currentSettings.callerName);
    this.callerNumber.set(currentSettings.callerNumber);
    this.message.set(currentSettings.message);
  }
  
  startCall() {
    const newSettings: FakeCallSettings = {
      callerName: this.callerName(),
      callerNumber: this.callerNumber(),
      message: this.message()
    };
    this.fakeCallService.updateSettings(newSettings);
    this.changeView.emit('fakeCall');
  }

  goBack() {
    this.changeView.emit('home');
  }

  onInput(field: 'callerName' | 'callerNumber' | 'message', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this[field].set(value);
  }
}
