/**
 * Herdado 1:1 de com.tessera.browser.audio.AudioTextNormalizer (Android v3.4.1)
 */
export function normalizeForSpeech(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  const text = rawText
    // 1. Remove tags HTML e URLs
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    // 2. Remove marcações markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`#>]/g, ' ')
    .replace(/^[-+*]\s+/gm, ' ')
    // 3. Converte moedas e unidades (padrão Tessera Bot)
    .replace(/R\$\s*(\d+(?:[.,]\d+)*)/gi, (_full, valGroup: string) => {
      const normalizedNumber = valGroup.includes(',')
        ? valGroup.replace(/\./g, '').replace(',', '.')
        : valGroup;
      const num = Number.parseFloat(normalizedNumber);
      if (!Number.isNaN(num)) {
        const inteira = Math.trunc(num);
        const centavos = Math.round((num - inteira) * 100);
        return centavos > 0 ? `${inteira} reais e ${centavos} centavos` : `${inteira} reais`;
      }
      return `${valGroup} reais`;
    })
    .replace(/\$\s*(\d+(?:[.,]\d+)*)/gi, '$1 dólares')
    .replace(/€\s*(\d+(?:[.,]\d+)*)/gi, '$1 euros')
    .replace(/\b(\d+)\s*km\/h\b/gi, '$1 quilômetros por hora')
    .replace(/\b(\d+)\s*kg\b/gi, '$1 quilos')
    .replace(/\b(\d+)\s*ml\b/gi, '$1 mililitros')
    .replace(/\b(\d+)\s*h\s*(\d+)\s*min\b/gi, '$1 horas e $2 minutos')
    .replace(/\b(\d+)\s*h\b/gi, '$1 horas')
    .replace(/\b(\d+)\s*min\b/gi, '$1 minutos')
    .replace(/\b(\d+)\s*seg\b/gi, '$1 segundos')
    .replace(/(\d+)%/g, '$1 por cento')
    // 4. Abreviações comuns PT-BR
    .replace(/\bvs\.?(?=\s|$)/gi, 'contra')
    .replace(/\bapê\b/gi, 'apartamento')
    .replace(/\bvc\b/gi, 'você')
    .replace(/\btbm\b/gi, 'também')
    .replace(/\bex\.:?/gi, 'por exemplo:')
    // 5. Remove caracteres isolados e pontuação excessiva
    .replace(/[•●▪■◆★☆✦✧]/g, ' ')
    .replace(/[|\\/_{}[\]]/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

export function splitIntoSentences(text: string, maxCharsPerChunk = 420): string[] {
  const normalized = normalizeForSpeech(text);
  if (!normalized) return [];
  if (normalized.length <= maxCharsPerChunk) return [normalized];

  const chunks: string[] = [];
  const sentences = normalized.split(/(?<=[.!?])\s+/);

  let current = '';
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if (sentence.length > maxCharsPerChunk) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      // Hard-split oversized sentence on commas/spaces
      const words = sentence.split(/\s+/);
      let sub = '';
      for (const word of words) {
        if (sub.length + word.length + 1 > maxCharsPerChunk && sub) {
          chunks.push(sub.trim());
          sub = '';
        }
        sub = sub ? `${sub} ${word}` : word;
      }
      if (sub) chunks.push(sub.trim());
      continue;
    }

    if (current.length + sentence.length + 1 > maxCharsPerChunk && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 0);
}
