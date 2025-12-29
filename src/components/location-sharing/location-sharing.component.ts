import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy, AfterViewInit, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocationService } from '../../services/location.service';
import { ContactService } from '../../services/contact.service';
import { Contact } from '../../models/contact.model';
import { LocationSharingService } from '../../services/location-sharing.service';

declare const L: any; // Declare Leaflet library

@Component({
  selector: 'app-location-sharing',
  templateUrl: './location-sharing.component.html',
  imports: [CommonModule],
})
export class LocationSharingComponent implements AfterViewInit, OnDestroy {
  locationSharingService = inject(LocationSharingService);
  contactService = inject(ContactService);
  locationService = inject(LocationService);

  isSharing = this.locationSharingService.isSharing;
  sharingRecipients = this.locationSharingService.sharingRecipients;
  
  contacts = this.contactService.contacts;
  groups = this.contactService.groups;
  coordinates = this.locationService.coordinates;
  locationStatus = this.locationService.locationStatus;
  locationErrorMessage = this.locationService.errorMessage;

  view = signal<'idle' | 'selecting' | 'confirming'>('idle');
  
  // Recipient selection state
  selectedGroupIds = signal<Set<number>>(new Set());
  selectedContactIds = signal<Set<number>>(new Set());
  recipientsForConfirmation = signal<Contact[]>([]);

  private map: any;
  private marker: any;
  mapContainer = viewChild<ElementRef<HTMLDivElement>>('map');

  constructor() {
    effect(() => {
      const isSharing = this.isSharing();
      const coords = this.coordinates();
      if (isSharing && coords) {
        setTimeout(() => this.initializeMap(), 0);
      }
    });

    effect(() => {
      const coords = this.coordinates();
      if (coords && this.map) {
        const latLng = [coords.latitude, coords.longitude];
        if (this.marker) {
          this.marker.setLatLng(latLng);
        } else {
          this.marker = L.marker(latLng, {
            icon: L.divIcon({
              className: 'custom-user-marker',
              html: `<div class="w-6 h-6 bg-indigo-500 rounded-full border-4 border-white shadow-lg animate-pulse"></div>`,
              iconSize: [24, 24],
            })
          }).addTo(this.map);
        }
        if (!this.map.getBounds().contains(latLng)) {
          this.map.setView(latLng, 15);
        }
      }
    });
  }

  ngAfterViewInit() {
    this.locationService.startWatchingPosition();
  }

  ngOnDestroy() {
    // We don't stop watching position here, as other components might need it.
    // The service manages its own lifecycle.
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  initializeMap() {
    const container = this.mapContainer()?.nativeElement;
    if (container && !this.map) {
      this.map = L.map(container, { center: [51.505, -0.09], zoom: 15, zoomControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
    }
  }

  startSharingProcess() {
    this.selectedGroupIds.set(new Set());
    this.selectedContactIds.set(new Set());
    this.recipientsForConfirmation.set([]);
    this.view.set('selecting');
  }

  stopSharing() {
    this.locationSharingService.stop();
  }
  
  cancelSelection() {
    this.view.set('idle');
  }

  toggleSelection(type: 'group' | 'contact', id: number) {
    if (type === 'group') {
      this.selectedGroupIds.update(ids => {
        const newIds = new Set(ids);
        newIds.has(id) ? newIds.delete(id) : newIds.add(id);
        return newIds;
      });
    } else {
      this.selectedContactIds.update(ids => {
        const newIds = new Set(ids);
        newIds.has(id) ? newIds.delete(id) : newIds.add(id);
        return newIds;
      });
    }
  }

  prepareToShare() {
    const finalContactIds = new Set(this.selectedContactIds());
    this.groups().forEach(group => {
      if (this.selectedGroupIds().has(group.id)) {
        group.contactIds.forEach(id => finalContactIds.add(id));
      }
    });

    if (finalContactIds.size === 0) return;

    const allContacts = new Map(this.contacts().map(c => [c.id, c]));
    const recipients = Array.from(finalContactIds)
      .map(id => allContacts.get(id))
      .filter((c): c is Contact => !!c);
      
    this.recipientsForConfirmation.set(recipients);
    this.view.set('confirming');
  }
  
  getConfirmationRecipientNames(): string {
    const recipients = this.recipientsForConfirmation();
    if (recipients.length === 0) return 'no one';
    if (recipients.length === 1) return recipients[0].name;
    if (recipients.length === 2) return `${recipients[0].name} and ${recipients[1].name}`;
    return `${recipients[0].name}, ${recipients[1].name}, and ${recipients.length - 2} others`;
  }

  confirmAndShare() {
    const recipients = this.recipientsForConfirmation();
    if (recipients.length === 0) return;

    this.locationSharingService.start(recipients);
    this.view.set('idle');
  }
  
  shareLink() {
    const coords = this.coordinates();
    if (!coords) {
      alert("Could not get your current location to share.");
      return;
    }

    const googleMapsUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
    const subject = "I'm sharing my location with you";
    const body = `Hi, I've started sharing my location. You can see my current position by clicking this link:\n\n${googleMapsUrl}\n\n(Note: This link provides a snapshot of my current location. The app on my end is tracking me live during this session.)\n\nSent from my Aura Safety app.`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
