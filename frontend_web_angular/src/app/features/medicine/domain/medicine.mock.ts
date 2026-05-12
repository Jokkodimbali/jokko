import { DoctorProfile, MedicineFilterAction } from './models/medicine.models';

const CHARLE_DIOUF: Omit<DoctorProfile, 'id'> = {
  name: 'Dr Charle Diouf',
  specialty: 'Chirurgien dentiste',
  rating: 4.9,
  reviewCount: 550,
  location: 'DAKAR',
  latitude: 14.6928,
  longitude: -17.4467,
  imageUrl: '/medicine-doctor-charle-diouf.png',
  isOnline: true,
  nextAvailability: ['MER 15', 'Jeu 16', 'ven 17', 'Sam 18'],
  modes: ['Teleconsult', 'Cabinet'],
  availability: [
    {
      period: 'Matin',
      days: ['MER 15', 'Jeu 16'],
    },
    {
      period: 'Apres-midi',
      days: ['ven 17', 'Sam 18'],
    },
  ],
};

export const MEDICINE_DOCTORS: DoctorProfile[] = [
  {
    ...CHARLE_DIOUF,
    id: 'charle-diouf',
  },
  {
    ...CHARLE_DIOUF,
    id: 'charle-diouf-2',
  },
  {
    ...CHARLE_DIOUF,
    id: 'charle-diouf-3',
  },
];

export const MEDICINE_FILTERS: MedicineFilterAction[] = [
  {
    label: 'Afficher la carte',
    icon: 'map',
    variant: 'accent',
  },
  {
    label: 'Filtre',
    icon: 'sliders-horizontal',
  },
  {
    label: 'Disponibilite',
    icon: 'calendar-days',
  },
];
