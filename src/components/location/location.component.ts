import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy, AfterViewInit, effect, ElementRef, viewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LocationService } from '../../services/location.service';
import { ContactService } from '../../services/contact.service';
import { Contact } from '../../models/contact.model';
import { SafetyZoneService } from '../../services/safety-zone.service';
import { SafetyZone } from '../../models/safety-zone.model';

declare const L: any; // Declare Leaflet library

@Component({
  selector: 'app-location',
  templateUrl: './location.component.html',
  imports: [CommonModule],
})
export class LocationComponent implements AfterViewInit, OnDestroy {
  locationService = inject(LocationService);
  contactService = inject(ContactService);
  safetyZoneService = inject(SafetyZoneService);
  private http = inject(HttpClient);

  status = this.locationService.locationStatus;
  coordinates = this.locationService.coordinates;
  errorMessage = this.locationService.errorMessage;
  contacts = this.contactService.contacts;
  groups = this.contactService.groups;
  zones = this.safetyZoneService.zones;
  zoneEvent = this.safetyZoneService.zoneEvent;
  
  isSharing = signal(false);
  showShareConfirmation = signal(false);
  
  private map: any;
  private marker: any;
  private hasSearchedForAreas = false;

  // Sharing flow state
  showRecipientSelector = signal(false);
  selectedGroupIds = signal<Set<number>>(new Set());
  selectedContactIds = signal<Set<number>>(new Set());
  sharingRecipients = signal<Contact[]>([]);

  // Safety Zone UI State
  isManagingZones = signal(false);
  editingZone = signal<(Partial<SafetyZone> & { tempId?: number }) | null>(null);
  private zoneCircleLayer: any;

  // SOS state
  isAlertSent = signal(false);
  isSosConfirmationShowing = signal(false);
  sosTarget = signal('');
  sosCountdown = signal(5);
  private sosCountdownInterval: any;
  private sosActionTimeout: any;
  hasEmergencyContacts = computed(() => this.contactService.contacts().length > 0);

  mapContainer = viewChild<ElementRef<HTMLDivElement>>('map');

  constructor() {
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
          this.map.setView(latLng, 14);
        }

        if (!this.hasSearchedForAreas) {
          this.findSafetyAreas(coords.latitude, coords.longitude);
          this.hasSearchedForAreas = true;
        }
      }
    });

    effect(() => {
      const zone = this.editingZone();
      if (this.map) {
        if (this.zoneCircleLayer) {
          this.zoneCircleLayer.remove();
          this.zoneCircleLayer = null;
        }
        if (zone && zone.latitude && zone.longitude && zone.radius) {
          this.zoneCircleLayer = L.circle([zone.latitude, zone.longitude], {
            radius: zone.radius,
            color: '#4f46e5',
            fillColor: '#4f46e5',
            fillOpacity: 0.2,
          }).addTo(this.map);
          this.map.fitBounds(this.zoneCircleLayer.getBounds());
        }
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.initializeMap(), 0);
    this.locationService.startWatchingPosition();
  }

  ngOnDestroy() {
    this.locationService.stopWatchingPosition();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.cancelSos();
  }

  initializeMap() {
    const container = this.mapContainer()?.nativeElement;
    if (container && !this.map) {
        this.map = L.map(container, { center: [51.505, -0.09], zoom: 13, zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }
  }

  findSafetyAreas(lat: number, lon: number) {
    const query = `[out:json];(node(around:5000,${lat},${lon})[amenity~"^(hospital|police)$"];);out;`;
    // Using a different Overpass API instance that may have more permissive CORS policies.
    const overpassUrl = 'https://overpass.kumi.systems/api/interpreter';
    this.http.get(`${overpassUrl}?data=${encodeURIComponent(query)}`).subscribe({
      next: (data: any) => this.addSafetyMarkers(data.elements),
      error: (err: HttpErrorResponse) => {
        // Provide a more descriptive error message. The original endpoint often fails due to CORS issues.
        console.error("Failed to fetch safety areas. This could be a network issue or the Overpass API might be down or blocking the request (CORS).", err.message);
      },
    });
  }

  addSafetyMarkers(areas: any[]) {
    if (!this.map) return; // FIX: Prevents error if component is destroyed before request finishes.
    const icons = {
      hospital: L.divIcon({ html: `<div class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md"><i class="fa-solid fa-house-chimney-medical"></i></div>`, className: 'custom-map-icon', iconSize: [32, 32] }),
      police: L.divIcon({ html: `<div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md"><i class="fa-solid fa-shield-halved"></i></div>`, className: 'custom-map-icon', iconSize: [32, 32] }),
    };
    areas.forEach(area => {
      if (area.tags) {
        const icon = area.tags.amenity === 'hospital' ? icons.hospital : icons.police;
        if (icon) {
          L.marker([area.lat, area.lon], { icon }).addTo(this.map).bindPopup(`<b>${area.tags.name || 'Safety Location'}</b><br>${area.tags.amenity}`);
        }
      }
    });
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

  openRecipientSelector() {
    this.selectedGroupIds.set(new Set());
    this.selectedContactIds.set(new Set());
    this.showRecipientSelector.set(true);
  }

  closeRecipientSelector() {
    this.showRecipientSelector.set(false);
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
      
    this.sharingRecipients.set(recipients);
    this.closeRecipientSelector();
    this.showShareConfirmation.set(true);
  }

  getSharingRecipientNames(): string {
    const recipients = this.sharingRecipients();
    if (recipients.length === 0) return 'no one';
    if (recipients.length === 1) return recipients[0].name;
    if (recipients.length === 2) return `${recipients[0].name} and ${recipients[1].name}`;
    return `${recipients[0].name}, ${recipients[1].name}, and ${recipients.length - 2} others`;
  }

  cancelShare() {
    this.showShareConfirmation.set(false);
    this.sharingRecipients.set([]);
  }

  confirmShareLocation() {
    this.showShareConfirmation.set(false);
    const coords = this.coordinates();
    if (!coords || this.sharingRecipients().length === 0) return;
    
    const googleMapsUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
    const subject = "Here's my live location";
    const body = `Hi, I'm sharing my live location with you. You can see where I am here: ${googleMapsUrl}`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    this.isSharing.set(true);
    setTimeout(() => {
      this.isSharing.set(false);
      this.sharingRecipients.set([]);
    }, 3000);
  }

  retry() { 
    this.hasSearchedForAreas = false; 
    this.locationService.retry(); 
  }

  // --- SOS Methods ---
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
      
      if (this.hasEmergencyContacts()) {
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
    const body = `URGENT: This is an automated SOS alert from my Aura Safety app.\n\nI am in a potential emergency and may need help.\n\n${locationInfo}\n\nPlease try to contact me immediately.`;

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

  // --- Safety Zone Methods ---

  openZoneManager() { this.isManagingZones.set(true); }
  closeZoneManager() {
    this.isManagingZones.set(false);
    this.editingZone.set(null);
  }
  
  editZone(zone: SafetyZone) {
    this.editingZone.set({ ...zone });
  }
  
  addNewZone() {
    this.editingZone.set({
      tempId: Date.now(),
      name: '',
      radius: 50,
      notifyOnEnter: true,
      notifyOnLeave: false,
      notificationContactIds: [],
      notificationGroupIds: [],
    });
  }

  deleteZone(id: number) {
    this.safetyZoneService.deleteZone(id);
    if(this.editingZone()?.id === id) {
       this.editingZone.set(null);
    }
  }

  setZoneLocationFromMapCenter() {
    const center = this.map.getCenter();
    this.editingZone.update(zone => zone ? { ...zone, latitude: center.lat, longitude: center.lng } : null);
  }

  setZoneLocationFromUser() {
    const userCoords = this.coordinates();
    if (userCoords) {
      this.editingZone.update(zone => zone ? { ...zone, latitude: userCoords.latitude, longitude: userCoords.longitude } : null);
    }
  }
  
  onZoneAttributeChange(field: keyof SafetyZone, value: any) {
    this.editingZone.update(zone => zone ? { ...zone, [field]: value } : null);
  }

  toggleZoneContact(id: number) {
    this.editingZone.update(zone => {
      if (!zone) return null;
      const contacts = new Set(zone.notificationContactIds || []);
      contacts.has(id) ? contacts.delete(id) : contacts.add(id);
      return { ...zone, notificationContactIds: Array.from(contacts) };
    });
  }

  toggleZoneGroup(id: number) {
    this.editingZone.update(zone => {
      if (!zone) return null;
      const groups = new Set(zone.notificationGroupIds || []);
      groups.has(id) ? groups.delete(id) : groups.add(id);
      return { ...zone, notificationGroupIds: Array.from(groups) };
    });
  }
  
  saveZone() {
    const zone = this.editingZone();
    if (!zone || !zone.name || !zone.latitude || !zone.longitude || !zone.radius) return;

    const zoneData = {
      id: zone.id || Date.now(),
      name: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius: zone.radius,
      notifyOnEnter: zone.notifyOnEnter ?? false,
      notifyOnLeave: zone.notifyOnLeave ?? false,
      notificationContactIds: zone.notificationContactIds || [],
      notificationGroupIds: zone.notificationGroupIds || [],
    };

    if(zone.id && !zone.tempId) {
      this.safetyZoneService.updateZone(zoneData);
    } else {
      this.safetyZoneService.addZone(zoneData);
    }
    this.editingZone.set(null);
  }
}