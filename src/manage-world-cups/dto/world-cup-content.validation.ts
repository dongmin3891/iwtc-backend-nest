import { type ValidationOptions, ValidateBy } from 'class-validator';

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function IsYoutubeWatchUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isYoutubeWatchUrl',
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          try {
            const url = new URL(value);
            const videoId = url.searchParams.get('v');
            return (
              url.protocol === 'https:' &&
              ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(
                url.hostname.toLowerCase(),
              ) &&
              url.pathname === '/watch' &&
              videoId !== null &&
              /^[A-Za-z0-9_-]{1,64}$/.test(videoId)
            );
          } catch {
            return false;
          }
        },
        defaultMessage(): string {
          return '미디어 주소는 HTTPS YouTube watch URL이어야 합니다.';
        },
      },
    },
    validationOptions,
  );
}
