/**
 * Utility to resolve Twitch clip URLs to direct playable MP4 video URLs.
 * Works with:
 * - https://clips.twitch.tv/ClipSlug
 * - https://www.twitch.tv/streamer/clip/ClipSlug
 * - https://www.twitch.tv/clips/ClipSlug
 * - Raw ClipSlug
 */

export function extractTwitchClipSlug(urlOrSlug: string): string | null {
  if (!urlOrSlug) return null;
  const trimmed = urlOrSlug.trim();

  // clips.twitch.tv/Slug
  const clipsTvMatch = trimmed.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/i);
  if (clipsTvMatch && clipsTvMatch[1]) {
    return clipsTvMatch[1];
  }

  // twitch.tv/.../clip/Slug or twitch.tv/clips/Slug
  const twitchTvMatch = trimmed.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/i) ||
                        trimmed.match(/twitch\.tv\/clips\/([A-Za-z0-9_-]+)/i);
  if (twitchTvMatch && twitchTvMatch[1]) {
    return twitchTvMatch[1];
  }

  // If already looks like a slug without spaces or slashes
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export interface TwitchClipResolved {
  mp4Url: string;
  title: string;
  duration?: number;
}

export async function resolveTwitchClip(urlOrSlug: string): Promise<TwitchClipResolved | null> {
  const slug = extractTwitchClipSlug(urlOrSlug);
  if (!slug) return null;

  // 1. Try server-side resolution first (no CORS, ultra-reliable)
  try {
    const serverRes = await fetch(`/api/twitch/resolve?url=${encodeURIComponent(urlOrSlug)}`);
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData && serverData.mp4Url) {
        return {
          mp4Url: serverData.mp4Url,
          title: serverData.title || '',
        };
      }
    }
  } catch (serverErr) {
    console.warn('Server twitch resolve failed, trying client directly', serverErr);
  }

  // 2. Client-side fallback via Twitch GQL
  try {
    const payload = [
      {
        variables: { slug },
        query: `query($slug: ID!) {
          clip(slug: $slug) {
            id
            title
            playbackAccessToken(params: { platform: "web", playerType: "site" }) {
              signature
              value
            }
            videoQualities {
              quality
              sourceURL
            }
          }
        }`,
      },
    ];

    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Twitch API returned status ${response.status}`);
    }

    const data = await response.json();
    const clip = data?.[0]?.data?.clip;
    if (!clip || !clip.videoQualities || clip.videoQualities.length === 0) {
      return null;
    }

    // Pick highest quality source URL (usually first)
    const bestQuality = clip.videoQualities[0];
    const signature = clip.playbackAccessToken?.signature;
    const value = clip.playbackAccessToken?.value;

    let mp4Url = bestQuality.sourceURL;
    if (signature && value) {
      const glue = mp4Url.includes('?') ? '&' : '?';
      mp4Url = `${mp4Url}${glue}sig=${signature}&token=${encodeURIComponent(value)}`;
    }

    return {
      mp4Url,
      title: clip.title || '',
    };
  } catch (error) {
    console.error('Failed to resolve Twitch clip:', error);
    return null;
  }
}
