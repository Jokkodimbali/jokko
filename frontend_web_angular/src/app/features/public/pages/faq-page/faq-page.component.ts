import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
})
export class FaqPageComponent {
  protected readonly topics = [
    {
      icon: 'search-check',
      title: 'Recherche',
      questions: [
        {
          q: 'Comment trouver un prestataire ou un medecin ?',
          a: 'Depuis la page Services, utilisez la recherche, les categories et les sous-categories pour filtrer les profils disponibles.',
        },
        {
          q: 'Pourquoi les medecins sont dans Services ?',
          a: 'Les medecins sont des prestataires de service de sante. Les regrouper permet au client de rechercher au meme endroit.',
        },
      ],
    },
    {
      icon: 'calendar-check',
      title: 'Rendez-vous',
      questions: [
        {
          q: 'Comment prendre rendez-vous avec un medecin ?',
          a: 'Ouvrez la carte du medecin puis cliquez sur Prendre rendez-vous. Le parcours garde le contexte du profil choisi.',
        },
        {
          q: 'Un medecin se deplace-t-il chez le client ?',
          a: 'Non. Pour les medecins, le client se deplace au cabinet ou au point de consultation indique.',
        },
      ],
    },
    {
      icon: 'message-circle',
      title: 'Messages',
      questions: [
        {
          q: 'A quoi sert la messagerie ?',
          a: 'Elle sert a discuter avec un professionnel, envoyer des informations utiles et garder une trace de la demande.',
        },
        {
          q: 'Puis-je negocier un prix ?',
          a: 'Oui, pour les prestataires concernes, le bouton de negociation permet de lancer une proposition claire.',
        },
      ],
    },
  ];
}
