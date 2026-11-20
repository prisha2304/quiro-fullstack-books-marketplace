const logger = require('./logger');

/**
 * Enterprise AI Provider Adapter for BookNest Marketplace
 * Supports OpenAI, Gemini, Ollama, and OpenAI-compatible custom providers.
 * Includes timeout, exponential backoff, response caching, and key redaction.
 */
class AIProviderAdapter {
    static cache = new Map();
    static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

    static getProviderConfig() {
        const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase().trim();
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        const customUrl = process.env.AI_BASE_URL;

        if (provider === 'gemini') {
            const isConfigured = Boolean(geminiKey && !geminiKey.includes('placeholder') && geminiKey !== 'YOUR_GEMINI_API_KEY');
            return {
                provider: 'gemini',
                isConfigured,
                apiKey: geminiKey,
                model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
            };
        }

        // Default: OpenAI or OpenAI-compatible
        const isConfigured = Boolean(openaiKey && !openaiKey.includes('placeholder') && openaiKey !== 'YOUR_OPENAI_API_KEY');
        return {
            provider: 'openai',
            isConfigured,
            apiKey: openaiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            baseUrl: customUrl || 'https://api.openai.com/v1'
        };
    }

    static isConfigured() {
        return this.getProviderConfig().isConfigured;
    }

    static redactSecrets(text) {
        if (!text || typeof text !== 'string') return text;
        return text
            .replace(/sk-[a-zA-Z0-9_\-]{20,}/g, 'sk-[REDACTED]')
            .replace(/AIza[a-zA-Z0-9_\-]{20,}/g, 'AIza[REDACTED]');
    }

    static getCacheKey(messages, model) {
        return model + ':' + JSON.stringify(messages);
    }

    /**
     * Generate Chat Completion with Timeout and Retries
     */
    static async generateCompletion({ systemPrompt = '', messages = [], temperature = 0.7, maxTokens = 800, timeoutMs = 12000, maxRetries = 2 }) {
        const config = this.getProviderConfig();

        if (!config.isConfigured) {
            const err = new Error('AI provider credentials are not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in server/.env.');
            err.code = 'AI_PROVIDER_NOT_CONFIGURED';
            throw err;
        }

        const fullMessages = [];
        if (systemPrompt) {
            fullMessages.push({ role: 'system', content: systemPrompt });
        }
        messages.forEach(m => fullMessages.push(m));

        // Check Cache
        const cacheKey = this.getCacheKey(fullMessages, config.model);
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
            return { content: cached.content, provider: config.provider, model: config.model, cached: true };
        }

        let attempt = 0;
        let lastError = null;

        while (attempt <= maxRetries) {
            try {
                let responseContent = '';

                if (config.provider === 'gemini') {
                    responseContent = await this.callGeminiAPI(config, fullMessages, temperature, timeoutMs);
                } else {
                    responseContent = await this.callOpenAIAPI(config, fullMessages, temperature, maxTokens, timeoutMs);
                }

                // Cache successful response
                this.cache.set(cacheKey, { content: responseContent, timestamp: Date.now() });

                return {
                    content: responseContent,
                    provider: config.provider,
                    model: config.model,
                    cached: false
                };
            } catch (err) {
                lastError = err;
                attempt++;
                if (attempt <= maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 500;
                    await new Promise(r => setTimeout(r, backoffMs));
                }
            }
        }

        logger.error('AI provider call failed after retries', {
            error: this.redactSecrets(lastError.message),
            provider: config.provider
        });
        throw lastError;
    }

    static async callOpenAIAPI(config, messages, temperature, maxTokens, timeoutMs) {
        const url = config.baseUrl + '/chat/completions';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.apiKey
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature,
                max_tokens: maxTokens
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error('OpenAI API responded with status ' + res.status + ': ' + this.redactSecrets(errBody));
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    static async callGeminiAPI(config, messages, temperature, timeoutMs) {
        const prompt = messages.map(m => m.role.toUpperCase() + ': ' + m.content).join('\n\n');
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + config.model + ':generateContent?key=' + config.apiKey;
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature, maxOutputTokens: 800 }
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error('Gemini API responded with status ' + res.status + ': ' + this.redactSecrets(errBody));
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
}

module.exports = AIProviderAdapter;
