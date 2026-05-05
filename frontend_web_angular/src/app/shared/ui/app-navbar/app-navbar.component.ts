import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

interface AppNavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './app-navbar.component.html',
  styleUrl: './app-navbar.component.scss',
})
export class AppNavbarComponent {
  private readonly router = inject(Router);

  protected readonly logo = '/logo.png';
  protected readonly profileChevronIcon =
    'https://www.figma.com/api/mcp/asset/0eebf22f-ce77-4427-a841-b94a93f49261';
  protected readonly settingsIcon =
    'https://www.figma.com/api/mcp/asset/e5cc1a27-5d3c-4512-b5e0-5c70255087ae';

  protected readonly navItems: AppNavItem[] = [
    {
      label: 'Services',
      icon: 'https://www.figma.com/api/mcp/asset/879f2a3c-78c7-437d-a16c-73236640c9a1',
      route: '/services',
    },
    {
      label: 'Médecine',
      icon: 'https://www.figma.com/api/mcp/asset/15de1656-647a-430f-bc5d-55ffe939217a',
      route: '/medecine',
    },
    {
      label: 'Rendez vous',
      icon: 'https://www.figma.com/api/mcp/asset/d44f3915-c915-4d53-ac4c-56858a07e8fc',
      route: '/appointments',
    },
    {
      label: 'Message',
      icon: 'https://www.figma.com/api/mcp/asset/7d89cf24-0508-4799-965a-4ca12372548c',
      route: '/messages',
    },
  ];

  protected isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
