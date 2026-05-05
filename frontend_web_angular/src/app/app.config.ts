import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IMAGE_CONFIG } from '@angular/common';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import {
  ArrowDown,
  CalendarDays,
  ChevronDown,
  MapPin,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  LucideAngularModule,
} from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), 
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    importProvidersFrom(
      LucideAngularModule.pick({
        ArrowDown,
        CalendarDays,
        ChevronDown,
        MapPin,
        Search,
        Settings,
        SlidersHorizontal,
        Star,
      }),
    ),
    {
      provide: IMAGE_CONFIG,
      useValue: {
        disableImageSizeWarning: true, 
        disableImageLazyLoadWarning: true
      }
    }
  ],
};
