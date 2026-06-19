import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  protected readonly channels = [
    {
      icon: 'map-pin',
      title: 'Adresse',
      value: 'Plateau de Dakar',
      detail: 'Senegal, Afrique de l Ouest',
    },
    {
      icon: 'phone-call',
      title: 'Telephone',
      value: '+221 77 345 67 89',
      detail: 'Assistance client et suivi de demande',
    },
    {
      icon: 'mail',
      title: 'E-mail',
      value: 'support@jokkodimbali.sn',
      detail: 'contact@jokkodimbali.sn',
    },
    {
      icon: 'clock',
      title: 'Horaires',
      value: 'Lun - Ven : 8h - 18h',
      detail: 'Sam : 9h - 13h',
    },
  ];

  protected readonly faqs = [
    {
      question: 'Comment trouver un prestataire ou un medecin ?',
      answer:
        'Depuis la page Services, utilisez la recherche, les categories et les sous-categories pour filtrer les profils disponibles.',
    },
    {
      question: 'Comment prendre rendez-vous avec un medecin ?',
      answer:
        'Ouvrez la carte du medecin puis cliquez sur Prendre rendez-vous. Le client se deplace ensuite au cabinet ou au point de consultation.',
    },
    {
      question: 'Puis-je negocier un prix avec un prestataire ?',
      answer:
        'Oui. Pour les prestataires, le bouton de negociation permet de lancer une proposition claire. Le client explique son besoin, propose un prix ou demande un devis, puis continue l echange dans la messagerie.',
    },
    {
      question: 'Comment signaler un litige ?',
      answer:
        'Depuis l espace compte, un client peut signaler un probleme lie a une prestation. Le litige garde les informations utiles, les messages et le suivi du dossier pour faciliter le traitement.',
    },
    {
      question: 'Comment suivre un prestataire ou une demande ?',
      answer:
        'Le client peut ajouter un prestataire en favoris, continuer la discussion dans Messages et retrouver ses rendez-vous ou demandes depuis son espace personnel.',
    },
    {
      question: 'A quoi sert la messagerie ?',
      answer:
        'La messagerie sert a clarifier le besoin, envoyer des images, pieces jointes ou vocaux, et garder une trace utile si un suivi ou un litige devient necessaire.',
    },
  ];

  protected readonly subjects = [
    'Reservation ou rendez-vous',
    'Compte client',
    'Prestataire ou medecin',
    'Paiement',
    'Signalement ou litige',
  ];

  protected readonly officialContacts = [
    {
      label: 'WhatsApp assistance',
      value: '+221 77 345 67 89',
      href: 'https://wa.me/221773456789',
    },
    {
      label: 'Appel direct',
      value: '+221 77 345 67 89',
      href: 'tel:+221773456789',
    },
    {
      label: 'Email support',
      value: 'support@jokkodimbali.sn',
      href: 'mailto:support@jokkodimbali.sn',
    },
    {
      label: 'Email contact',
      value: 'contact@jokkodimbali.sn',
      href: 'mailto:contact@jokkodimbali.sn',
    },
  ];

  protected readonly socialLinks = [
    {
      label: 'Facebook',
      href: 'https://facebook.com',
      color: '#1877f2',
      viewBox: '0 0 24 24',
      paths: ['M15.1 8.1h2.1V4.4c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 2-5.4 5.7v3.2H5v4.2h3.6V24H13v-6.7h3.5l.6-4.2H13V10.3c0-1.2.3-2.2 2.1-2.2Z'],
    },
    {
      label: 'Instagram',
      href: 'https://instagram.com',
      color: '#e4405f',
      viewBox: '0 0 24 24',
      paths: [
        'M7.4 2h9.2A5.4 5.4 0 0 1 22 7.4v9.2a5.4 5.4 0 0 1-5.4 5.4H7.4A5.4 5.4 0 0 1 2 16.6V7.4A5.4 5.4 0 0 1 7.4 2Zm0 2A3.4 3.4 0 0 0 4 7.4v9.2A3.4 3.4 0 0 0 7.4 20h9.2a3.4 3.4 0 0 0 3.4-3.4V7.4A3.4 3.4 0 0 0 16.6 4H7.4Z',
        'M12 7.2A4.8 4.8 0 1 1 12 16.8 4.8 4.8 0 0 1 12 7.2Zm0 2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z',
        'M17.2 6.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z',
      ],
    },
    {
      label: 'LinkedIn',
      href: 'https://linkedin.com',
      color: '#0a66c2',
      viewBox: '0 0 24 24',
      paths: ['M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 9.8h4V22H3V9.8Zm6.2 0H13v1.7h.1c.5-1 1.9-2 3.9-2 4.1 0 4.9 2.7 4.9 6.2V22h-4v-5.6c0-1.3 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V22h-4V9.8Z'],
    },
    {
      label: 'TikTok',
      href: 'https://tiktok.com',
      color: '#111111',
      viewBox: '0 0 24 24',
      paths: ['M16.7 2c.3 2.5 1.8 4.3 4.3 4.5v3.6a7.5 7.5 0 0 1-4.2-1.3v6.8c0 4.1-2.8 6.4-6.1 6.4-3.5 0-6.2-2.7-6.2-6.1 0-3.9 3.4-6.8 7.3-6v3.8c-1.8-.6-3.5.7-3.5 2.3 0 1.3 1 2.4 2.4 2.4 1.5 0 2.4-.9 2.4-2.9V2h3.6Z'],
    },
    {
      label: 'X',
      href: 'https://x.com',
      color: '#111111',
      viewBox: '0 0 24 24',
      paths: ['M18.9 2h3.4l-7.4 8.5L23.6 22h-6.8l-5.3-7-6.1 7H2l7.9-9.1L1.6 2h7l4.8 6.4L18.9 2Zm-1.2 18h1.9L7.6 3.9h-2L17.7 20Z'],
    },
  ];
}
