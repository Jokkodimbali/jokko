export interface AvailabilitySlot {
  period: string;
  days: string[];
}

export interface DoctorProfile {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  location: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string;
  isOnline: boolean;
  availability: AvailabilitySlot[];
  nextAvailability: string[];
  modes: Array<'Teleconsult' | 'Cabinet'>;
}

export interface MedicineFilterAction {
  label: string;
  icon: 'map' | 'sliders-horizontal' | 'calendar-days';
  variant?: 'accent';
}
