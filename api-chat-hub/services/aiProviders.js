export class OpenAIProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(messages, model = 'o4-mini') {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
          }),
        });

        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || Math.pow(2, attempt);
          const waitTime = parseInt(retryAfter) * 1000; // Convert to milliseconds
          
          console.log(`OpenAI rate limit hit. Retrying in ${waitTime/1000} seconds... (Attempt ${attempt + 1}/${maxRetries})`);
          
          if (attempt < maxRetries - 1) {
            await this.sleep(waitTime);
            attempt++;
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || response.statusText;
          throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          model: data.model,
          tokenCount: data.usage?.total_tokens
        };

      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error; // Re-throw on final attempt
        }
        
        console.log(`OpenAI request failed (attempt ${attempt + 1}): ${error.message}`);
        await this.sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
        attempt++;
      }
    }
  }

  async generateImage(prompt, options = {}) {
    const {
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'standard',
      n = 1
    } = options;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        n
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`OpenAI Image API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    return {
      images: data.data.map(img => ({
        url: img.url,
        revised_prompt: img.revised_prompt
      })),
      model
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class GeminiProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(messages, model = 'gemini-3-pro-image-preview') {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Convert messages to Gemini format
        const parts = messages.filter(msg => msg.role !== 'system').map(msg => ({
          text: msg.content
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts
            }]
          }),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || Math.pow(2, attempt);
          const waitTime = parseInt(retryAfter) * 1000;
          
          console.log(`Gemini rate limit hit. Retrying in ${waitTime/1000} seconds... (Attempt ${attempt + 1}/${maxRetries})`);
          
          if (attempt < maxRetries - 1) {
            await this.sleep(waitTime);
            attempt++;
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || response.statusText;
          throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();
        return {
          content: data.candidates[0].content.parts[0].text,
          model
        };

      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        console.log(`Gemini request failed (attempt ${attempt + 1}): ${error.message}`);
        await this.sleep(1000 * Math.pow(2, attempt));
        attempt++;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class PerplexityProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(messages, model = 'sonar-pro') {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
          }),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || Math.pow(2, attempt);
          const waitTime = parseInt(retryAfter) * 1000;
          
          console.log(`Perplexity rate limit hit. Retrying in ${waitTime/1000} seconds... (Attempt ${attempt + 1}/${maxRetries})`);
          
          if (attempt < maxRetries - 1) {
            await this.sleep(waitTime);
            attempt++;
            continue;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || response.statusText;
          throw new Error(`Perplexity API error (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          model: data.model,
          tokenCount: data.usage?.total_tokens
        };

      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        console.log(`Perplexity request failed (attempt ${attempt + 1}): ${error.message}`);
        await this.sleep(1000 * Math.pow(2, attempt));
        attempt++;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createProvider(provider, apiKey) {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'perplexity':
      return new PerplexityProvider(apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
