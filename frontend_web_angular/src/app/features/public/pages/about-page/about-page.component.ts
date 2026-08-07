import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent {
  protected readonly values = [
    {
      icon: 'shield-check',
      title: 'Confiance',
      text: 'Des profils structures pour mieux comprendre le service, la specialite et les avis.',
    },
    {
      icon: 'handshake',
      title: 'Proximite',
      text: 'Un acces simple aux prestataires et medecins utiles dans la vie quotidienne.',
    },
    {
      icon: 'sparkles',
      title: 'Clarite',
      text: 'Des parcours courts, des informations visibles et des actions faciles a trouver.',
    },
  ];

  protected readonly milestones = [
    'Le client recherche un service, une specialite, un medecin ou un prestataire.',
    'La page Services affiche les profils avec specialite, disponibilite, avis, zone et action utile.',
    'Le client contacte, negocie un prix ou prend rendez-vous selon le type de professionnel.',
    'Les messages, favoris et rendez-vous gardent le contexte pour suivre la relation facilement.',
  ];

  protected readonly audiences = [
    {
      title: 'Clients',
      text: 'Trouver rapidement un professionnel fiable, comprendre son domaine et lancer la bonne action.',
    },
    {
      title: 'Prestataires',
      text: 'Presenter ses services, recevoir des demandes, negocier et developper sa visibilite locale.',
    },
    {
      title: 'Medecins',
      text: 'Afficher la specialite, centraliser les rendez-vous et permettre aux patients de se deplacer au bon endroit.',
    },
  ];

  protected readonly strengths = [
    'Recherche centralisee pour medecins et prestataires',
    'Specialite visible directement sur les cartes',
    'Favoris pour retrouver les professionnels importants',
    'Messagerie avec pieces jointes, images et vocal',
    'Rendez-vous medicaux separes des negociations de service',
    'Parcours pense pour le client comme pour le professionnel',
  ];

  protected readonly detailedProcesses = [
    {
      icon: 'wallet-cards',
      title: 'Negociation avec un prestataire',
      text: 'Pour les services non medicaux, le client peut lancer une proposition de prix. La discussion garde le contexte du prestataire, du service demande et des echanges afin de clarifier le besoin avant de confirmer.',
    },
    {
      icon: 'scale',
      title: 'Signalement de litige',
      text: "Si une prestation pose probleme, le client peut signaler un litige depuis son espace. Le suivi permet d'expliquer la situation, conserver les messages utiles et suivre l'evolution du dossier.",
    },
    {
      icon: 'user-round-cog',
      title: 'Suivi des prestataires',
      text: 'Les prestataires disposent d un espace pour suivre leurs demandes, leurs negociations, leurs clients, leur profil et les informations importantes liees a leur activite.',
    },
    {
      icon: 'calendar-check',
      title: 'Suivi des rendez-vous medicaux',
      text: 'Pour les medecins, le parcours est separe de la negociation : le client prend rendez-vous, se deplace au cabinet ou au point de consultation, puis retrouve son historique dans ses rendez-vous.',
    },
    {
      icon: 'message-circle',
      title: 'Messagerie et preuves utiles',
      text: 'La messagerie permet de discuter, envoyer des images, pieces jointes ou messages vocaux. Elle garde une trace claire pour le client, le prestataire et le suivi en cas de besoin.',
    },
  ];
}
