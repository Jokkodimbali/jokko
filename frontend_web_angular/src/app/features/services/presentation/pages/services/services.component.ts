import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServicesService } from '../../../data-access/services.service';
import { ServiceSection, PaginationMeta } from '../../../domain/models/services.models';
import { SERVICES_UI_MESSAGES } from '../../../domain/services-ui.messages';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterLink, AppFooterComponent],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent implements OnInit {
  private readonly servicesService = inject(ServicesService);

  protected readonly logo = 'logo.png';
  protected readonly heroIllustration =
    'https://www.figma.com/api/mcp/asset/df350815-f1b2-49f7-8cd6-e1247f7601d1';
  protected readonly storeBadges = {
    android: 'https://www.figma.com/api/mcp/asset/2906dca2-fdd1-4ee5-a323-01852209bcbf',
    ios: 'https://www.figma.com/api/mcp/asset/c4e5df90-6a5e-42bb-b9e6-4b4a60126e47',
  };

  protected readonly navItems = [
    {
      label: 'Services',
      icon: 'https://www.figma.com/api/mcp/asset/07f2916c-5c9b-4a26-90cd-a201ea91b055',
      active: true,
      route: '/services',
    },
    {
      label: 'Medecine',
      icon: 'https://www.figma.com/api/mcp/asset/09737efc-aeb0-4cda-9c65-7d950fdacf60',
      active: false,
      route: '/medecine',
    },
    {
      label: 'Rendez vous',
      icon: 'https://www.figma.com/api/mcp/asset/94fdd59a-0f9e-47fd-b56d-8740052d45c4',
      active: false,
      route: '/appointments',
    },
    {
      label: 'Message',
      icon: 'https://www.figma.com/api/mcp/asset/2311431c-fa67-4ea0-a4b1-e8faa8b39e60',
      active: false,
      route: '/messages',
    },
  ];

  sections = signal<ServiceSection[]>([]);
  categoryPagination = signal<PaginationMeta | undefined>(undefined);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadHomeData();
  }

  onViewAll(section: ServiceSection): void {
    const nextPage = (section.pagination?.page || 1) + 1;
    if (section.pagination && nextPage > section.pagination.totalPages) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.servicesService.getProfessionalsByCategory(section.id, nextPage, 6).subscribe({
      next: (result) => {
        this.sections.update((sects) =>
          sects.map((s) =>
            s.id === section.id
              ? {
                  ...s,
                  providers: [...s.providers, ...result.providers],
                  pagination: result.meta,
                }
              : s,
          ),
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(SERVICES_UI_MESSAGES.loadMoreProfessionalsFailed);
        this.isLoading.set(false);
      },
    });
  }

  loadHomeData(page: number = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.servicesService.getServiceHomeData(page, 5).subscribe({
      next: (result) => {
        if (page === 1) {
          this.sections.set(result.sections);
        } else {
          this.sections.update((s) => [...s, ...result.sections]);
        }
        this.categoryPagination.set(result.meta);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set(SERVICES_UI_MESSAGES.loadServicesFailed);
        this.isLoading.set(false);
      },
    });
  }

  loadMoreCategories(): void {
    const nextPage = (this.categoryPagination()?.page || 1) + 1;
    this.loadHomeData(nextPage);
  }
}
