import { DoctorProfile, MedicineFilterAction } from './models/medicine.models';

export const MEDICINE_DOCTORS: DoctorProfile[] = [
  {
    id: 'charle-diouf',
    name: 'Dr Charle Diouf',
    specialty: 'Chirurgien dentiste',
    rating: 4.9,
    reviewCount: 550,
    imageUrl: '/medicine-doctor-charle-diouf.png',
    isOnline: true,
    availability: [
      {
        period: 'Matin',
        days: ['mer 15', 'jeudi 16'],
      },
      {
        period: 'Après-midi',
        days: ['mer 15', 'jeudi 16'],
      },
    ],
  },
  {
    id: 'charle-diouf-2',
    name: 'Dr Charle Diouf',
    specialty: 'Chirurgien dentiste',
    rating: 4.9,
    reviewCount: 550,
    imageUrl: '/medicine-doctor-charle-diouf.png',
    isOnline: true,
    availability: [
      {
        period: 'Matin',
        days: ['mer 15', 'jeudi 16'],
      },
      {
        period: 'Après-midi',
        days: ['mer 15', 'jeudi 16'],
      },
    ],
  },
];

export const MEDICINE_FILTERS: MedicineFilterAction[] = [
  {
    label: 'Afficher la carte',
    icon: 'map-pin',
    variant: 'accent',
  },
  {
    label: 'Filtre',
    icon: 'sliders-horizontal',
  },
  {
    label: 'Disponibilité',
    icon: 'calendar-days',
  },
];
