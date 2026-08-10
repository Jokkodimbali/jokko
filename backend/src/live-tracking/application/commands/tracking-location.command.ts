export type TrackingLocationCommand = {
  recordedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKmh?: number;
  locationLabel?: string;
};
