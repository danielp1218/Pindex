import { BetRelationship } from '@/types/graph';

const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || '';
if (!API_BASE_URL) {
  throw new Error('VITE_API_ENDPOINT is not defined');
}

export interface SourceMarket {
  id: string;
  question: string;
  slug: string;
}

export interface RelatedBet {
  marketId: string;
  question: string;
  slug: string;
  url: string;
  relationship: BetRelationship;
  reasoning: string;
  yesPercentage: number;
  noPercentage: number;
}

export interface RelatedBetsResponse {
  sourceMarket: SourceMarket;
  relatedBets: RelatedBet[];
}

export interface StreamProgress {
  message: string;
  timestamp: number;
}

export interface FetchRelatedBetsOptions {
  url: string;
  signal?: AbortSignal;
  onProgress?: (progress: StreamProgress) => void;
}

export async function fetchRelatedBets({
  url,
  signal,
  onProgress,
}: FetchRelatedBetsOptions): Promise<RelatedBetsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/related-bets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');

  // Handle SSE streaming response
  if (contentType?.includes('text/event-stream')) {
    return parseSSEStream(response, onProgress);
  }

  // Handle regular JSON response
  return response.json();
}

// Parse prefixed SSE data format: "log - {...}" or "final - {...}"
function parseSSEData(data: string): { type: 'log' | 'final' | 'unknown'; payload: any } {
  // Handle "log - {...}" format
  if (data.startsWith('log - ')) {
    try {
      const jsonPart = data.slice(6); // Remove "log - " prefix
      const parsed = JSON.parse(jsonPart);
      return { type: 'log', payload: parsed };
    } catch (e) {
      console.warn('Failed to parse log SSE data:', data);
      return { type: 'unknown', payload: null };
    }
  }

  // Handle "final - {...}" format
  if (data.startsWith('final - ')) {
    try {
      const jsonPart = data.slice(8); // Remove "final - " prefix
      const parsed = JSON.parse(jsonPart);
      return { type: 'final', payload: parsed };
    } catch (e) {
      console.warn('Failed to parse final SSE data:', data);
      return { type: 'unknown', payload: null };
    }
  }

  // Try parsing as raw JSON (fallback for direct JSON responses)
  try {
    const parsed = JSON.parse(data);
    // Check if it looks like a final result
    if (parsed.sourceMarket && parsed.relatedBets) {
      return { type: 'final', payload: parsed };
    }
    if (parsed.type === 'log' && parsed.message) {
      return { type: 'log', payload: parsed };
    }
    if (parsed.type === 'final' && parsed.data) {
      return { type: 'final', payload: parsed.data };
    }
    return { type: 'unknown', payload: parsed };
  } catch (e) {
    return { type: 'unknown', payload: null };
  }
}

async function parseSSEStream(
  response: Response,
  onProgress?: (progress: StreamProgress) => void
): Promise<RelatedBetsResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: RelatedBetsResponse | null = null;
  let errorResult: string | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('event:')) {
        continue;
      }

      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();

        if (!data) continue;

        console.log('[related-bets][sse]', data);

        const { type, payload } = parseSSEData(data);

        if (type === 'log' && payload?.message) {
          onProgress?.({
            message: payload.message,
            timestamp: Date.now(),
          });
        }

        if (type === 'final' && payload) {
          // Check if the final payload is an error
          if (payload.error) {
            errorResult = payload.error;
          } else if (payload.sourceMarket && payload.relatedBets) {
            finalResult = payload;
          }
        }
      }
    }
  }

  if (errorResult) {
    throw new Error(errorResult);
  }

  if (!finalResult) {
    throw new Error('No final result received from SSE stream');
  }

  return finalResult;
}
