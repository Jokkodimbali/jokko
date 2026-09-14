import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { Conversation, ConversationMessage } from '../domain/models/messages.models';

export type MediaDownloadTarget = {
  url: string;
  fileName: string;
  revokeAfterUse: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class MessagesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/conversations`;

  listConversations(limit = 30, offset = 0): Observable<Conversation[]> {
    return this.http
      .get<ApiResponse<Conversation[]>>(this.apiUrl, {
        params: {
          limit: limit.toString(),
          offset: offset.toString(),
        },
      })
      .pipe(map(unwrapApiResponse));
  }

  createConversation(payload: {
    reservationId?: string;
    negotiationId?: string;
    professionalProfileId?: string;
    professionalUserId?: string;
  }): Observable<Conversation> {
    return this.http
      .post<ApiResponse<Conversation>>(this.apiUrl, payload)
      .pipe(map(unwrapApiResponse));
  }

  listMessages(conversationId: string, limit = 50, offset = 0): Observable<ConversationMessage[]> {
    return this.http
      .get<ApiResponse<ConversationMessage[]>>(`${this.apiUrl}/${conversationId}/messages`, {
        params: {
          limit: limit.toString(),
          offset: offset.toString(),
        },
      })
      .pipe(map(unwrapApiResponse));
  }

  sendMessage(
    conversationId: string,
    content: string,
    mediaUrl?: string,
  ): Observable<ConversationMessage> {
    return this.http
      .post<ApiResponse<ConversationMessage>>(`${this.apiUrl}/${conversationId}/messages`, {
        content,
        ...(mediaUrl ? { mediaUrl } : {}),
      })
      .pipe(map(unwrapApiResponse));
  }

  uploadMedia(file: File): Observable<{ mediaUrl: string }> {
    const formData = new FormData();
    formData.append('media', file);

    return this.http
      .post<ApiResponse<{ mediaUrl: string }>>(`${this.apiUrl}/media`, formData)
      .pipe(map(unwrapApiResponse));
  }

  downloadMedia(mediaUrl: string): Observable<Blob> {
    const resolvedUrl = this.resolveMediaUrl(mediaUrl);

    if (this.isCloudinaryUrl(resolvedUrl)) {
      return this.http.get(`${this.apiUrl}/media/download`, {
        params: {
          mediaUrl,
          fileName: this.mediaFileName(mediaUrl),
        },
        responseType: 'blob',
      });
    }

    return this.http.get(resolvedUrl, {
      responseType: 'blob',
    });
  }

  resolveMediaDownloadTarget(mediaUrl: string): Observable<MediaDownloadTarget> {
    const resolvedUrl = this.resolveMediaUrl(mediaUrl);

    if (this.isCloudinaryUrl(resolvedUrl)) {
      return this.downloadMedia(mediaUrl).pipe(
        map((blob) => ({
          url: URL.createObjectURL(blob),
          fileName: this.mediaFileName(mediaUrl),
          revokeAfterUse: true,
        })),
      );
    }

    return this.http.get(resolvedUrl, { responseType: 'blob' }).pipe(
      map((blob) => ({
        url: URL.createObjectURL(blob),
        fileName: this.mediaFileName(mediaUrl),
        revokeAfterUse: true,
      })),
    );
  }

  private resolveMediaUrl(mediaUrl: string): string {
    if (/^https?:\/\//i.test(mediaUrl)) {
      return mediaUrl;
    }

    const apiOrigin = new URL(environment.apiUrl).origin;
    return mediaUrl.startsWith('/') ? `${apiOrigin}${mediaUrl}` : `${apiOrigin}/${mediaUrl}`;
  }

  private isCloudinaryUrl(mediaUrl: string): boolean {
    try {
      return new URL(mediaUrl).hostname.endsWith('cloudinary.com');
    } catch {
      return false;
    }
  }

  private mediaFileName(url: string): string {
    const cleanUrl = url.split('?')[0].split('#')[0];
    return decodeURIComponent(cleanUrl.split('/').pop() || 'piece-jointe');
  }
}
