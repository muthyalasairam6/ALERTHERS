import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeComponent } from './components/home/home.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { TipsComponent } from './components/tips/tips.component';
import { FakeCallComponent } from './components/fake-call/fake-call.component';
import { FakeCallSettingsComponent } from './components/fake-call-settings/fake-call-settings.component';
import { LocationComponent } from './components/location/location.component';
import { LocationSharingComponent } from './components/location-sharing/location-sharing.component';
import { LocationSharingService } from './services/location-sharing.service';
import { AiWatchComponent } from './components/ai-watch/ai-watch.component';
import { BatteryService } from './services/battery.service';

type View = 'home' | 'contacts' | 'tips' | 'location' | 'sharing' | 'fakeCall' | 'sos' | 'fakeCallSettings' | 'aiWatch';

interface NavItem {
  view: View;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    HomeComponent,
    ContactsComponent,
    TipsComponent,
    FakeCallComponent,
    FakeCallSettingsComponent,
    LocationComponent,
    LocationSharingComponent,
    AiWatchComponent,
  ],
})
export class AppComponent {
  locationSharingService = inject(LocationSharingService);
  batteryService = inject(BatteryService);
  isSharingLocation = this.locationSharingService.isSharing;
  currentView = signal<View>('home');

  navItems: NavItem[] = [
    { view: 'home', icon: 'fa-house', label: 'Home' },
    { view: 'sharing', icon: 'fa-share-nodes', label: 'Sharing' },
    { view: 'location', icon: 'fa-location-dot', label: 'Location' },
    { view: 'contacts', icon: 'fa-address-book', label: 'Contacts' },
    { view: 'tips', icon: 'fa-lightbulb', label: 'Safety Tips' }
  ];

  changeView(view: View) {
    this.currentView.set(view);
  }
}