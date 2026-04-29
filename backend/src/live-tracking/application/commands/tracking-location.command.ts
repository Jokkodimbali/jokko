export type TrackingLocationCommand = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKmh?: number;
  locationLabel?: string;
};
