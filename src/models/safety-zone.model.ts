export interface SafetyZone {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  notifyOnEnter: boolean;
  notifyOnLeave: boolean;
  notificationContactIds: number[];
  notificationGroupIds: number[];
}
