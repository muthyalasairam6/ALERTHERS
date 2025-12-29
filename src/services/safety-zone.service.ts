import { Injectable, signal, inject, effect } from '@angular/core';
import { SafetyZone } from '../models/safety-zone.model';
import { LocationService, Coordinates } from './location.service';
import { ContactService } from './contact.service';
import { Group } from '../models/group.model';
import { Contact } from '../models/contact.model';

@Injectable({
  providedIn: 'root',
})
export class SafetyZoneService {
  private readonly STORAGE_KEY = 'safety_app_safety_zones';
  private locationService = inject(LocationService);
  private contactService = inject(ContactService);

  zones = signal<SafetyZone[]>([]);
  zoneEvent = signal<{zone: SafetyZone, event: 'enter' | 'leave'} | null>(null);

  private lastZoneStatus = new Map<number, boolean>();
  private isMonitoringInitialized = false;

  constructor() {
    this.loadZones();
    effect(() => {
      const coords = this.locationService.coordinates();
      if (coords) {
        this.checkZones(coords);
      }
    });
  }

  private loadZones(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.zones.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error reading safety zones from localStorage', e);
    }
  }

  private saveZones(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.zones()));
    } catch (e) {
      console.error('Error saving safety zones to localStorage', e);
    }
  }
  
  addZone(zone: Omit<SafetyZone, 'id'>): void {
    this.zones.update(zones => [...zones, { ...zone, id: Date.now() }]);
    this.saveZones();
    this.resetMonitoring();
  }

  updateZone(updatedZone: SafetyZone): void {
    this.zones.update(zones => zones.map(z => z.id === updatedZone.id ? updatedZone : z));
    this.saveZones();
    this.resetMonitoring();
  }

  deleteZone(id: number): void {
    this.zones.update(zones => zones.filter(z => z.id !== id));
    this.saveZones();
    this.resetMonitoring();
  }

  public resetMonitoring(): void {
    this.isMonitoringInitialized = false;
    this.lastZoneStatus.clear();
  }

  private initializeZoneStatus(coords: Coordinates): void {
    this.zones().forEach(zone => {
      const distance = this.haversineDistance(coords, { latitude: zone.latitude, longitude: zone.longitude });
      this.lastZoneStatus.set(zone.id, distance <= zone.radius);
    });
    this.isMonitoringInitialized = true;
  }

  private checkZones(coords: Coordinates): void {
    if (!this.isMonitoringInitialized) {
      this.initializeZoneStatus(coords);
      return;
    }

    this.zones().forEach(zone => {
      const distance = this.haversineDistance(coords, { latitude: zone.latitude, longitude: zone.longitude });
      const isInside = distance <= zone.radius;
      const wasInside = this.lastZoneStatus.get(zone.id);
      
      if (wasInside === undefined) return;

      if (isInside && !wasInside && zone.notifyOnEnter) {
        this.sendNotification(zone, 'enter');
      } else if (!isInside && wasInside && zone.notifyOnLeave) {
        this.sendNotification(zone, 'leave');
      }

      this.lastZoneStatus.set(zone.id, isInside);
    });
  }

  private sendNotification(zone: SafetyZone, event: 'enter' | 'leave'): void {
    // FIX: Explicitly type the Maps to ensure correct type inference.
    const allContacts = new Map<number, Contact>(this.contactService.contacts().map(c => [c.id, c]));
    const groups = new Map<number, Group>(this.contactService.groups().map(g => [g.id, g]));

    const recipientContactIds = new Set(zone.notificationContactIds);
    zone.notificationGroupIds.forEach(groupId => {
      const group = groups.get(groupId);
      // FIX: Use an if-check to safely access properties on a potentially undefined value.
      // This resolves the 'unknown' type error and prevents a runtime error.
      if (group) {
        group.contactIds.forEach(contactId => recipientContactIds.add(contactId));
      }
    });

    const recipients = Array.from(recipientContactIds)
        .map(id => allContacts.get(id))
        .filter((c): c is Contact => !!c);

    if (recipients.length === 0) return;
    
    // In a real app, this would use a backend service for SMS/Push. We'll use mailto:
    const eventText = event === 'enter' ? 'entered' : 'left';
    const subject = `Safety Zone Alert: ${eventText} ${zone.name}`;
    const body = `This is an automated message from Aura Safety.\n\nI have just ${eventText} the '${zone.name}' safety zone.`;
    const bcc = recipients.map(r => r.phone).join(','); // Not a real email, but shows intent

    // This is a browser action, so we fire and forget.
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    this.zoneEvent.set({ zone, event });
    setTimeout(() => this.zoneEvent.set(null), 5000); // Clear event after 5s
  }
  
  // Haversine formula to calculate distance between two lat/lon points
  private haversineDistance(coords1: Coordinates, coords2: Coordinates): number {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371e3; // Earth radius in metres

    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }
}