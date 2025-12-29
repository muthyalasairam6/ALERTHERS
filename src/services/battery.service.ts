import { Injectable, signal, computed } from '@angular/core';

// The BatteryManager interface might not be in default TS libs,
// so we define the parts of the interface that we need.
interface BatteryManager {
  level: number;
  charging: boolean;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

declare global {
  interface Navigator {
    getBattery?(): Promise<BatteryManager>;
  }
}

@Injectable({
  providedIn: 'root',
})
export class BatteryService {
  level = signal(1); // Assume 100% initially
  isCharging = signal(true); // Assume charging initially
  notificationDismissed = signal(false);

  isLow = computed(() => this.level() <= 0.2 && !this.isCharging());

  private batteryManager: BatteryManager | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if ('getBattery' in navigator && typeof navigator.getBattery === 'function') {
      try {
        this.batteryManager = await navigator.getBattery();
        this.updateBatteryStatus();

        this.batteryManager.addEventListener('levelchange', this.updateBatteryStatus);
        this.batteryManager.addEventListener('chargingchange', this.updateBatteryStatus);
      } catch (error) {
        console.error('Could not initialize Battery Status API:', error);
      }
    } else {
      console.warn('Battery Status API is not supported in this browser.');
    }
  }

  private updateBatteryStatus = (): void => {
    if (this.batteryManager) {
      this.level.set(this.batteryManager.level);
      this.isCharging.set(this.batteryManager.charging);
      
      // If the battery is no longer low (e.g., it's charging or above 20%),
      // reset the notification dismissal state so it can appear again later.
      if (!this.isLow()) {
        this.notificationDismissed.set(false);
      }
    }
  };

  dismissNotification(): void {
    this.notificationDismissed.set(true);
  }
}