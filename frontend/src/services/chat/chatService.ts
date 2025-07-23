import { apiService } from '../api.service';
import { API_BASE_URL } from '@/constants';
import type { ApiResponse } from '@/types/api.types';
import type {
    ChatCompletionResponse,
    ChatCompletionMessage
} from '@/types/chat';

export class ChatService {
    /**
     * Send a message to the assistant and get a regular (non-streaming) response
     */
    static async sendMessage(
        assistantName: string,
        messages: ChatCompletionMessage[],
        sessionId?: string,
        temperature?: number
    ): Promise<ApiResponse<ChatCompletionResponse>> {
        try {
            // Format the request payload according to OpenAI API format
            const payload: Record<string, any> = {
                model: assistantName,
                messages,
                stream: false,
                session_id: sessionId
            };

            // Add optional parameters if provided
            if (temperature !== undefined) {
                payload.temperature = temperature;
            }

            return await apiService.post('/api/v1/chat/completions', payload);
        } catch (error: unknown) {
            console.error('Error sending message to assistant:', error);

            // Enhance error with more context
            if (error instanceof Error) {
                error.message = `Failed to send message to assistant "${assistantName}": ${error.message}`;
            }

            throw error;
        }
    }

    /**
     * Stream a response from the assistant
     * Returns an abort function that can be called to cancel the stream
     */
    static streamMessage(
        assistantName: string,
        messages: ChatCompletionMessage[],
        onChunk: (chunk: string) => void,
        onDone: () => void,
        onError: (error: unknown) => void,
        options?: {
            sessionId?: string;
            temperature?: number;
            maxTokens?: number;
            retryOnError?: boolean;
        }
    ): () => void {
        const controller = new AbortController();
        const { signal } = controller;
        const { sessionId, temperature, maxTokens, retryOnError = false } = options || {};
        let retryCount = 0;
        const MAX_RETRIES = 3;

        const fetchStream = async () => {
            try {
                // Prepare request payload
                const payload: Record<string, any> = {
                    model: assistantName,
                    messages,
                    stream: true,
                    session_id: sessionId
                };

                // Add optional parameters
                if (temperature !== undefined) {
                    payload.temperature = temperature;
                }

                if (maxTokens !== undefined) {
                    payload.max_tokens = maxTokens;
                }

                // Make the streaming request
                const response = await fetch(`${API_BASE_URL}/api/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiService.getApiKey()}`,
                        ...(sessionId && { 'Session-ID': sessionId })
                    },
                    body: JSON.stringify(payload),
                    signal
                });

                // Handle HTTP errors
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `HTTP error! status: ${response.status}`;

                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.detail || errorJson.message || errorJson.error) {
                            errorMessage = errorJson.detail || errorJson.message || errorJson.error.message || errorMessage;
                        }
                    } catch (e) {
                        // If parsing fails, use the raw text if available
                        if (errorText) {
                            errorMessage = `${errorMessage}: ${errorText}`;
                        }
                    }

                    throw new Error(errorMessage);
                }

                // Get reader from response body
                const reader = response.body?.getReader();
                if (!reader) throw new Error('Response body is null');

                // Process the stream
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();

                            // Check for stream end
                            if (data === '[DONE]') {
                                onDone();
                                return;
                            }

                            // Parse and process chunk
                            try {
                                const parsed = JSON.parse(data);

                                // Handle content delta
                                if (parsed.choices?.[0]?.delta?.content) {
                                    onChunk(parsed.choices[0].delta.content);
                                }

                                // Handle error in the stream
                                if (parsed.error) {
                                    throw new Error(parsed.error.message || 'Error in stream');
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                                // Only throw if it's not a JSON parse error
                                if (!(e instanceof SyntaxError)) {
                                    throw e;
                                }
                            }
                        }
                    }
                }

                // Stream completed successfully
                onDone();
            } catch (error: unknown) {
                // Don't report abort errors (user cancelled)
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                // Retry logic for network errors
                if (retryOnError && retryCount < MAX_RETRIES) {
                    retryCount++;
                    console.warn(`Stream error, retrying (${retryCount}/${MAX_RETRIES})...`, error);

                    // Exponential backoff
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(fetchStream, delay);
                    return;
                }

                // Report the error
                console.error('Stream error:', error);
                onError(error);
            }
        };

        // Start the stream
        fetchStream();

        // Return abort function
        return () => controller.abort();
    }
}