import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IMAGE_CONFIG } from '@angular/common';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock3,
  Heart,
  HeartPlus,
  HeartPulse,
  LogOut,
  Map,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Search,
  Share2,
  Settings,
  SlidersHorizontal,
  Star,
  Users,
  Video,
  X,
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
        ArrowLeft,
        ArrowRight,
        ArrowUpRight,
        Banknote,
        CalendarDays,
        Camera,
        ChevronDown,
        Clock3,
        Heart,
        HeartPlus,
        HeartPulse,
        LogOut,
        Map,
        MapPin,
        MessageCircle,
        MoreHorizontal,
        MoreVertical,
        Plus,
        Search,
        Share2,
        Settings,
        SlidersHorizontal,
        Star,
        Users,
        Video,
        X,
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
