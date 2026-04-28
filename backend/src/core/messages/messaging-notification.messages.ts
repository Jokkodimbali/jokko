const MAX_PREVIEW_LENGTH = 80;

function buildPreview(content: string | null, mediaUrl: string | null): string {
  if (content && content.trim().length > 0) {
    const normalized = content.trim();
    return normalized.length > MAX_PREVIEW_LENGTH
      ? `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1)}…`
      : normalized;
  }

  if (mediaUrl) {
    return 'Vous avez recu un media.';
  }

  return 'Vous avez recu un nouveau message.';
}

export const MESSAGING_NOTIFICATION_MESSAGES = {
  newMessageTitle: 'Nouveau message',
  newMessageBody: (input: {
    senderName: string;
    content: string | null;
    mediaUrl: string | null;
  }) => `${input.senderName} : ${buildPreview(input.content, input.mediaUrl)}`,
} as const;
