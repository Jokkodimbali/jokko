import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ServicesService } from '../../../data-access/services.service';
import { ServiceSection, PaginationMeta } from '../../../domain/models/services.models';
import { SERVICES_UI_MESSAGES } from '../../../domain/services-ui.messages';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';

  @Component({
    selector: 'app-services',
    standalone: true,
    imports: [CommonModule, RouterLink, AppFooterComponent, LucideAngularModule],
    templateUrl: './services.component.html',
    styleUrl: './services.component.scss',
  })
export class ServicesComponent implements OnInit {
  private readonly servicesService = inject(ServicesService);

  protected readonly logo =
    'https://www.figma.com/api/mcp/asset/ef96ce3a-5f45-4060-b60b-e20978378ba4';
  protected readonly heroIllustration =
    'https://www.figma.com/api/mcp/asset/9f194bf6-3fd1-4012-bb76-dc280db53929';
  protected readonly profileChevronIcon =
    'https://www.figma.com/api/mcp/asset/0eebf22f-ce77-4427-a841-b94a93f49261';
  protected readonly settingsIcon =
    'https://www.figma.com/api/mcp/asset/e5cc1a27-5d3c-4512-b5e0-5c70255087ae';
  protected readonly locationIcon =
    'https://www.figma.com/api/mcp/asset/d7e611d1-1f73-4aba-ac86-e2cb08f08b89';
  protected readonly fallbackAvatars = [
    'https://www.figma.com/api/mcp/asset/6fbed90c-597f-4a65-9803-f64e71b550c5',
    'https://www.figma.com/api/mcp/asset/bd04523b-1aa5-479e-806b-1929dcc43dab',
    'https://www.figma.com/api/mcp/asset/8ac6c017-5cd7-4960-a3d2-3e839aa68a3f',
    'https://www.figma.com/api/mcp/asset/fd9a2b60-ecaa-4a48-90cf-61f71dac88d6',
  ];
  protected readonly fallbackPhotos = [
    'https://www.figma.com/api/mcp/asset/86becdf8-4abc-4072-85ff-1b21088f7fd0',
    'https://www.figma.com/api/mcp/asset/69c4201e-99e0-426f-9213-6df5a95fe4e9',
    'https://www.figma.com/api/mcp/asset/dd8f6549-6b09-41ac-b1f1-fe63f6bd292a',
    'https://www.figma.com/api/mcp/asset/d3ba4c59-bc9b-49d2-88b1-48ff60c3f0c4',
    'https://www.figma.com/api/mcp/asset/75efea4c-2efe-4333-ac01-5224440c6148',
    'https://www.figma.com/api/mcp/asset/897d1143-68ee-47bd-9e3e-fafceb170ad4',
    'https://www.figma.com/api/mcp/asset/e7027761-7239-4313-83b7-225104e195f5',
    'https://www.figma.com/api/mcp/asset/99f79ff2-baa5-437c-9f99-5e6e793818da',
  ];

  protected readonly navItems = [
    {
      label: 'Services',
      icon: 'https://www.figma.com/api/mcp/asset/879f2a3c-78c7-437d-a16c-73236640c9a1',
      active: true,
      route: '/services',
    },
    {
      label: 'M\u00e9decine',
      icon: 'https://www.figma.com/api/mcp/asset/15de1656-647a-430f-bc5d-55ffe939217a',
      active: false,
      route: '/medecine',
    },
    {
      label: 'Rendez vous',
      icon: 'https://www.figma.com/api/mcp/asset/d44f3915-c915-4d53-ac4c-56858a07e8fc',
      active: false,
      route: '/appointments',
    },
    {
      label: 'Message',
      icon: 'https://www.figma.com/api/mcp/asset/7d89cf24-0508-4799-965a-4ca12372548c',
      active: false,
      route: '/messages',
    },
  ];

  sections = signal<ServiceSection[]>([]);
  categoryPagination = signal<PaginationMeta | undefined>(undefined);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  favoriteProviders = computed(() =>
    this.sections()
      .flatMap((section) => section.providers)
      .slice(0, 4),
  );

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

  resolveProviderAvatar(provider: { avatar?: string }, index: number): string {
    return provider.avatar || this.fallbackAvatars[index % this.fallbackAvatars.length];
  }

  resolveProviderPhoto(
    provider: { photos: string[] },
    providerIndex: number,
    photoIndex: number,
  ): string {
    return (
      provider.photos[photoIndex] ||
      this.fallbackPhotos[(providerIndex * 2 + photoIndex) % this.fallbackPhotos.length]
    );
  }
}
