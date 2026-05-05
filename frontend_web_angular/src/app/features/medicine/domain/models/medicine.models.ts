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
  imageUrl: string;
  isOnline: boolean;
  availability: AvailabilitySlot[];
}

export interface MedicineFilterAction {
  label: string;
  icon: 'map-pin' | 'sliders-horizontal' | 'calendar-days';
  variant?: 'accent';
}
