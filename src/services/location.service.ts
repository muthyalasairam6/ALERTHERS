import { Injectable, signal } from '@angular/core';

export type LocationStatus = 'loading' | 'success' | 'error';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  locationStatus = signal<LocationStatus>('loading');
  coordinates = signal<Coordinates | null>(null);
  errorMessage = signal<string | null>(null);
  private watchId: number | null = null;

  startWatchingPosition(): void {
    if (this.watchId !== null) return; // Already watching

    this.locationStatus.set('loading');
    this.errorMessage.set(null);
    
    if (!navigator.geolocation) {
      this.locationStatus.set('error');
      this.errorMessage.set('Geolocation is not supported by your browser.');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.coordinates.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (this.locationStatus() !== 'success') {
           this.locationStatus.set('success');
        }
      },
      (error) => {
        this.coordinates.set(null);
        this.locationStatus.set('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.errorMessage.set('Location access was denied. Please enable it in your settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            this.errorMessage.set('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            this.errorMessage.set('The request to get user location timed out.');
            break;
          default:
            this.errorMessage.set('An unknown error occurred while fetching location.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  stopWatchingPosition(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  retry() {
    this.stopWatchingPosition();
    this.startWatchingPosition();
  }
}
