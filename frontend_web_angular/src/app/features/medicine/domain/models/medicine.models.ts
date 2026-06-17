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
  modes: string[];
  availability: AvailabilitySlot[];
  nextAvailability: string[];
}

export interface MedicineFilterAction {
  label: string;
  icon: 'search' | 'map' | 'sliders-horizontal' | 'calendar-days';
  variant?: 'accent';
}
