import { getEventIdFromUrl } from './eventStorage';

const GAMMA_API = 'https://gamma-api.polymarket.com';

export interface PolymarketEventInfo {
  slug: string;
  title: string;
  question: string;
  url: string;
  imageUrl?: string;
}

const eventInfoCache = new Map<string, Omit<PolymarketEventInfo, 'url'>>();

function titleFromSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isValidImageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.startsWith('http');
}

function pickEventImage(event: any): string | undefined {
  const candidates = [
    event?.image,
    event?.imageUrl,
    event?.image_url,
    event?.icon,
    event?.iconUrl,
    event?.icon_url,
    event?.bannerImage,
    event?.banner_image,
    event?.coverImage,
    event?.cover_image,
    event?.thumbnail,
    event?.thumbnailUrl,
    event?.thumbnail_url,
    event?.markets?.[0]?.image,
    event?.markets?.[0]?.imageUrl,
    event?.markets?.[0]?.image_url,
    event?.markets?.[0]?.icon,
    event?.markets?.[0]?.iconUrl,
    event?.markets?.[0]?.icon_url,
    event?.markets?.[0]?.coverImage,
    event?.markets?.[0]?.cover_image,
    event?.markets?.[0]?.thumbnail,
  ];

  return candidates.find(isValidImageUrl);
}

export async function fetchEventInfoFromUrl(url: string): Promise<PolymarketEventInfo | null> {
  const slug = getEventIdFromUrl(url);
  if (!slug) {
    return null;
  }

  const cached = eventInfoCache.get(slug);
  if (cached) {
    return { ...cached, url };
  }

  const fallbackTitle = titleFromSlug(slug) || 'Market';

  try {
    const response = await fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) {
      const fallback = {
        slug,
        title: fallbackTitle,
        question: fallbackTitle,
        url,
      };
      eventInfoCache.set(slug, {
        slug: fallback.slug,
        title: fallback.title,
        question: fallback.question,
      });
      return fallback;
    }

    const events = await response.json();
    const event = Array.isArray(events) ? events[0] : events;
    const question =
      event?.markets?.[0]?.question ||
      event?.title ||
      event?.question ||
      fallbackTitle;
    const imageUrl = pickEventImage(event);
    
    if (!imageUrl && event) {
      console.log('[polymarketClient] No image found for event:', slug, 'Event data:', JSON.stringify(event).slice(0, 500));
    }

    const info = {
      slug,
      title: question,
      question,
      url,
      imageUrl,
    };
    eventInfoCache.set(slug, {
      slug: info.slug,
      title: info.title,
      question: info.question,
      imageUrl: info.imageUrl,
    });
    return info;
  } catch (error) {
    const fallback = {
      slug,
      title: fallbackTitle,
      question: fallbackTitle,
      url,
    };
    eventInfoCache.set(slug, {
      slug: fallback.slug,
      title: fallback.title,
      question: fallback.question,
    });
    return fallback;
  }
}
