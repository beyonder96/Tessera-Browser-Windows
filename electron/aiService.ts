import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import type { AiChatMessage, AiProviderId } from '../src/shared/types';

interface StoredKeysFile {
  geminiEncryptedBase64?: string;
  groqEncryptedBase64?: string;
  geminiFallbackPlain?: string;
  groqFallbackPlain?: string;
}

/**
 * Herdado 1:1 de com.tessera.browser.ai.TesseraAiEngine (Android v3.4.1)
 * Com proteção de credenciais via Windows DPAPI (Electron safeStorage).
 */
export class TesseraAiService {
  private readonly keysFilePath: string;

  constructor(userDataDir: string) {
    fs.mkdirSync(userDataDir, { recursive: true });
    this.keysFilePath = path.join(userDataDir, 'tessera_ai_keys.json');
  }

  private readKeysFile(): StoredKeysFile {
    if (!fs.existsSync(this.keysFilePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.keysFilePath, 'utf-8')) as StoredKeysFile;
    } catch {
      return {};
    }
  }

  private writeKeysFile(data: StoredKeysFile): void {
    fs.writeFileSync(this.keysFilePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  setApiKey(provider: AiProviderId, rawKey: string): { hasGeminiKey: boolean; hasGroqKey: boolean } {
    const trimmed = rawKey.trim();
    const current = this.readKeysFile();

    const canEncrypt = safeStorage.isEncryptionAvailable();
    if (provider === 'GEMINI') {
      if (!trimmed) {
        delete current.geminiEncryptedBase64;
        delete current.geminiFallbackPlain;
      } else if (canEncrypt) {
        current.geminiEncryptedBase64 = safeStorage.encryptString(trimmed).toString('base64');
        delete current.geminiFallbackPlain;
      } else {
        current.geminiFallbackPlain = trimmed;
      }
    } else {
      if (!trimmed) {
        delete current.groqEncryptedBase64;
        delete current.groqFallbackPlain;
      } else if (canEncrypt) {
        current.groqEncryptedBase64 = safeStorage.encryptString(trimmed).toString('base64');
        delete current.groqFallbackPlain;
      } else {
        current.groqFallbackPlain = trimmed;
      }
    }

    this.writeKeysFile(current);
    return this.getKeyStatus();
  }

  getApiKey(provider: AiProviderId): string {
    const current = this.readKeysFile();
    try {
      if (provider === 'GEMINI') {
        if (current.geminiEncryptedBase64 && safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(Buffer.from(current.geminiEncryptedBase64, 'base64'));
        }
        return current.geminiFallbackPlain || '';
      } else {
        if (current.groqEncryptedBase64 && safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(Buffer.from(current.groqEncryptedBase64, 'base64'));
        }
        return current.groqFallbackPlain || '';
      }
    } catch {
      return '';
    }
  }

  getKeyStatus(): { hasGeminiKey: boolean; hasGroqKey: boolean } {
    return {
      hasGeminiKey: Boolean(this.getApiKey('GEMINI')),
      hasGroqKey: Boolean(this.getApiKey('GROQ'))
    };
  }

  async generateSummary(params: {
    provider: AiProviderId;
    pageTitle: string;
    pageDomain: string;
    pageContent: string;
  }): Promise<string> {
    const apiKey = this.getApiKey(params.provider);
    if (!apiKey) {
      throw new Error(
        `Nenhuma chave de API configurada para ${params.provider === 'GEMINI' ? 'Google Gemini' : 'Groq Cloud'}.`
      );
    }

    const trimmedContent =
      params.pageContent.length > 12000
        ? `${params.pageContent.slice(0, 12000)}\n...[conteúdo resumido para análise]`
        : params.pageContent;

    const systemPrompt = [
      'Você é o assistente inteligente minimalista do navegador Tessera.',
      'Sua missão é resumir com máxima clareza, precisão e elegância o conteúdo da página que o usuário está visualizando.',
      '',
      'Diretrizes:',
      '- Escreva em Português do Brasil de forma direta e sem jargões desnecessários.',
      '- Estruture com:',
      '  1. **Visão Geral**: 1 a 2 parágrafos sintetizando a essência e o propósito do texto.',
      "  2. **Pontos-Chave**: 3 a 5 tópicos objetivos com os principais fatos ou aprendizados (use '- ' para cada ponto).",
      '  3. **Conclusão**: 1 parágrafo curto sobre o impacto, conclusão ou recomendação.',
      '- Seja conciso e evite prolixidade.'
    ].join('\n');

    const userPrompt = `Página: ${params.pageTitle}\nOrigem: ${params.pageDomain}\n\nConteúdo da página:\n${trimmedContent}`;
    const messages: AiChatMessage[] = [
      { id: '1', role: 'user', content: userPrompt, timestamp: Date.now() }
    ];

    if (params.provider === 'GROQ') {
      return this.executeGroqRequest(apiKey, systemPrompt, messages);
    }
    return this.executeGeminiRequest(apiKey, systemPrompt, messages);
  }

  async askQuestion(params: {
    provider: AiProviderId;
    pageTitle: string;
    pageDomain: string;
    pageContent: string;
    conversationHistory: AiChatMessage[];
    userQuestion: string;
  }): Promise<string> {
    const apiKey = this.getApiKey(params.provider);
    if (!apiKey) {
      throw new Error(
        `Nenhuma chave de API configurada para ${params.provider === 'GEMINI' ? 'Google Gemini' : 'Groq Cloud'}.`
      );
    }

    const trimmedContent =
      params.pageContent.length > 12000
        ? `${params.pageContent.slice(0, 12000)}\n...[conteúdo contextualizado]`
        : params.pageContent;

    const systemPrompt = [
      'Você é o assistente inteligente minimalista do navegador Tessera.',
      `O usuário está navegando na página "${params.pageTitle}" (${params.pageDomain}) e tem dúvidas específicas sobre ela.`,
      '',
      'Conteúdo de referência da página:',
      trimmedContent,
      '',
      'Diretrizes:',
      '- Responda à dúvida do usuário de maneira clara, objetiva e útil em Português do Brasil.',
      '- Priorize as informações contidas no texto da página. Se a resposta não estiver no texto, esclareça isso e responda com base no seu conhecimento geral com sinceridade.',
      '- Seja amigável, direto ao ponto e não utilize introduções repetitivas.'
    ].join('\n');

    const fullHistory: AiChatMessage[] = [
      ...params.conversationHistory,
      { id: String(Date.now()), role: 'user', content: params.userQuestion, timestamp: Date.now() }
    ];

    if (params.provider === 'GROQ') {
      return this.executeGroqRequest(apiKey, systemPrompt, fullHistory);
    }
    return this.executeGeminiRequest(apiKey, systemPrompt, fullHistory);
  }

  private async executeGroqRequest(
    apiKey: string,
    systemPrompt: string,
    messages: AiChatMessage[]
  ): Promise<string> {
    const payload = {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      ]
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: `Bearer ${apiKey.trim()}`,
        'User-Agent': 'TesseraBrowserWindows/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      throw new Error('Resposta vazia da API do Groq.');
    }

    const errBody = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('Chave Groq inválida ou expirada. Verifique em console.groq.com.');
    }
    if (res.status === 429) {
      throw new Error('Limite de requisições do Groq atingido. Aguarde alguns segundos.');
    }
    throw new Error(`Erro no Groq (${res.status}): ${errBody.slice(0, 180)}`);
  }

  private async executeGeminiRequest(
    apiKey: string,
    systemPrompt: string,
    messages: AiChatMessage[]
  ): Promise<string> {
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-3.8-flash'
    ];
    let lastError = 'Modelo Gemini indisponível.';

    for (const modelName of modelsToTry) {
      let isFirst = true;
      const contents = messages.map((msg) => {
        let textContent = msg.content;
        if (isFirst && msg.role === 'user') {
          isFirst = false;
          textContent = `${systemPrompt}\n\n${msg.content}`;
        }
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: textContent }]
        };
      });

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'TesseraBrowserWindows/1.0'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 2048
          }
        })
      });

      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
        throw new Error('Resposta vazia da API do Gemini.');
      }

      if (res.status === 404) {
        lastError = `Modelo ${modelName} não encontrado (404).`;
        continue;
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error('Chave Gemini inválida ou sem permissão. Verifique em aistudio.google.com.');
      }
      if (res.status === 429) {
        throw new Error('Cota de requisições do Gemini atingida. Tente novamente em instantes.');
      }
      const errText = await res.text().catch(() => '');
      throw new Error(`Erro no Gemini (${res.status}): ${errText.slice(0, 180)}`);
    }

    throw new Error(lastError);
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    isWakeWordCheck = false
  ): Promise<string> {
    const groqKey = this.getApiKey('GROQ');
    const geminiKey = this.getApiKey('GEMINI');

    if (!groqKey && !geminiKey) {
      throw new Error(
        'Nenhuma chave de IA configurada para reconhecimento de voz. Configure sua chave gratuita do Groq (Whisper) ou Gemini nas Configurações de IA.'
      );
    }

    // 1. Try Groq Whisper (ultra-fast ~150ms transcription)
    if (groqKey) {
      try {
        const text = await this.executeGroqWhisper(groqKey, audioBuffer, mimeType, isWakeWordCheck);
        if (text) return text;
      } catch (err: any) {
        console.warn('[TesseraAiService] Groq Whisper failed:', err?.message || err);
        if (!geminiKey) {
          throw err;
        }
      }
    }

    // 2. Try Google Gemini Audio Transcription
    if (geminiKey) {
      try {
        const text = await this.executeGeminiAudio(geminiKey, audioBuffer, mimeType);
        if (text) return text;
      } catch (err: any) {
        console.warn('[TesseraAiService] Gemini Audio failed:', err?.message || err);
        throw err;
      }
    }

    return '';
  }

  private async executeGroqWhisper(
    apiKey: string,
    audioBuffer: Buffer,
    mimeType: string,
    isWakeWordCheck = false
  ): Promise<string> {
    const cleanMime = (mimeType || 'audio/webm').split(';')[0];
    const ext = cleanMime.includes('webm')
      ? 'webm'
      : cleanMime.includes('ogg')
      ? 'ogg'
      : cleanMime.includes('wav')
      ? 'wav'
      : cleanMime.includes('mp4') || cleanMime.includes('m4a')
      ? 'm4a'
      : 'webm';

    const formData = new FormData();
    const file = new File([new Uint8Array(audioBuffer)], `voice_command.${ext}`, { type: cleanMime });
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    formData.append(
      'prompt',
      isWakeWordCheck
        ? 'Transcrição em português brasileiro.'
        : 'Comandos de voz: pesquisar, resumir, nova guia, abrir site, modo leitor, modo escuro, ler página, Tessera.'
    );

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'User-Agent': 'TesseraBrowserWindows/1.0'
      },
      body: formData
    });

    if (res.ok) {
      const json = (await res.json()) as { text?: string };
      return json.text?.trim() || '';
    }

    // Fallback to whisper-large-v3 if whisper-large-v3-turbo returned 404 or model error
    if (res.status === 404 || res.status === 400) {
      const fbFormData = new FormData();
      const fbFile = new File([new Uint8Array(audioBuffer)], `voice_command.${ext}`, { type: cleanMime });
      fbFormData.append('file', fbFile);
      fbFormData.append('model', 'whisper-large-v3');
      fbFormData.append('language', 'pt');
      fbFormData.append('response_format', 'json');

      const fbRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'User-Agent': 'TesseraBrowserWindows/1.0'
        },
        body: fbFormData
      });

      if (fbRes.ok) {
        const fbJson = (await fbRes.json()) as { text?: string };
        return fbJson.text?.trim() || '';
      }
    }

    const errText = await res.text().catch(() => '');
    throw new Error(`Groq Whisper (${res.status}): ${errText.slice(0, 160)}`);
  }

  private async executeGeminiAudio(
    apiKey: string,
    audioBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const cleanMime = (mimeType || 'audio/webm').split(';')[0];
    const base64Data = audioBuffer.toString('base64');
    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash'
    ];

    let lastErr = 'Gemini Audio indisponível.';

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'User-Agent': 'TesseraBrowserWindows/1.0'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: base64Data
                  }
                },
                {
                  text: 'Transcreva em Português do Brasil exatamente o que o usuário falou neste comando de voz para o navegador. Retorne estritamente o texto falado sem aspas, sem pontuações desnecessárias e sem nenhuma explicação.'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256
          }
        })
      });

      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        return text.replace(/^["']|["']$/g, '').trim();
      }

      if (res.status === 404) {
        lastErr = `Modelo Gemini ${model} 404`;
        continue;
      }

      const errText = await res.text().catch(() => '');
      lastErr = `Gemini Audio (${res.status}): ${errText.slice(0, 160)}`;
      break;
    }

    throw new Error(lastErr);
  }
}
