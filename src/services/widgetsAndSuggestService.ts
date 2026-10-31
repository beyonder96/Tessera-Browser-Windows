import type { QuoteItem, QuotesData, SearchEngineId, WeatherData } from '../shared/types';

function getWeatherConditionText(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'Céu limpo' : 'Noite estrelada';
  if (code === 1 || code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Encoberto';
  if (code === 45 || code === 48) return 'Nevoeiro';
  if (code >= 51 && code <= 57) return 'Garoa leve';
  if (code >= 61 && code <= 67) return 'Chuva';
  if (code >= 71 && code <= 77) return 'Neve';
  if (code >= 80 && code <= 82) return 'Pancadas de chuva';
  if (code >= 95) return 'Tempestade';
  return 'Parcialmente nublado';
}

/**
 * Herdado de BrowserViewModel.fetchWeather (Android v3.4.1)
 */
export async function fetchLiveWeather(): Promise<WeatherData> {
  let lat = -23.5505;
  let lon = -46.6333;
  let cityName = 'São Paulo';

  try {
    const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (geoRes.ok) {
      const geo = (await geoRes.json()) as { latitude?: string; longitude?: string; city?: string };
      if (geo.latitude) lat = Number.parseFloat(geo.latitude) || lat;
      if (geo.longitude) lon = Number.parseFloat(geo.longitude) || lon;
      if (geo.city) cityName = geo.city;
    }
  } catch {
    try {
      const fallbackRes = await fetch('https://ipwho.is/');
      if (fallbackRes.ok) {
        const geo = (await fallbackRes.json()) as { latitude?: number; longitude?: number; city?: string };
        if (typeof geo.latitude === 'number') lat = geo.latitude;
        if (typeof geo.longitude === 'number') lon = geo.longitude;
        if (geo.city) cityName = geo.city;
      }
    } catch {
      // Keep default São Paulo
    }
  }

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code&timezone=auto`;
    const res = await fetch(weatherUrl);
    if (res.ok) {
      const json = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
          is_day?: number;
          weather_code?: number;
        };
      };
      if (json.current) {
        const temp = Math.round(json.current.temperature_2m ?? 24);
        const apparent = Math.round(json.current.apparent_temperature ?? temp);
        const humidity = Math.round(json.current.relative_humidity_2m ?? 65);
        const isDay = (json.current.is_day ?? 1) === 1;
        const code = json.current.weather_code ?? 1;
        return {
          cityName,
          temperature: temp,
          apparentTemperature: apparent,
          humidity,
          conditionText: getWeatherConditionText(code, isDay),
          weatherCode: code,
          isDay,
          isLoading: false,
          lastUpdated: Date.now()
        };
      }
    }
  } catch {
    // Fallback below
  }

  return {
    cityName,
    temperature: 24,
    apparentTemperature: 24,
    humidity: 64,
    conditionText: 'Parcialmente nublado',
    weatherCode: 1,
    isDay: true,
    isLoading: false,
    lastUpdated: Date.now()
  };
}

/**
 * Herdado de BrowserViewModel.fetchQuotes (Android v3.4.1)
 */
export async function fetchLiveQuotes(): Promise<QuotesData> {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
    if (res.ok) {
      const json = (await res.json()) as Record<
        string,
        { bid?: string; pctChange?: string } | undefined
      >;
      const items: QuoteItem[] = [];

      const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
      const formatPct = (pct: number) => `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`;

      if (json.USDBRL) {
        const bid = Number.parseFloat(json.USDBRL.bid || '5.64');
        const pct = Number.parseFloat(json.USDBRL.pctChange || '0');
        items.push({
          symbol: 'USD',
          name: 'Dólar',
          value: formatCurrency(bid),
          change: formatPct(pct),
          isPositive: pct >= 0
        });
      }

      if (json.EURBRL) {
        const bid = Number.parseFloat(json.EURBRL.bid || '6.18');
        const pct = Number.parseFloat(json.EURBRL.pctChange || '0');
        items.push({
          symbol: 'EUR',
          name: 'Euro',
          value: formatCurrency(bid),
          change: formatPct(pct),
          isPositive: pct >= 0
        });
      }

      if (json.BTCBRL) {
        const bid = Number.parseFloat(json.BTCBRL.bid || '358000');
        const pct = Number.parseFloat(json.BTCBRL.pctChange || '0');
        const value = bid >= 1000 ? `R$ ${Math.round(bid / 1000)}k` : `R$ ${Math.round(bid)}`;
        items.push({
          symbol: 'BTC',
          name: 'Bitcoin',
          value,
          change: formatPct(pct),
          isPositive: pct >= 0
        });
      }

      if (items.length > 0) {
        return {
          items,
          isLoading: false,
          lastUpdated: Date.now()
        };
      }
    }
  } catch {
    // Fallback below
  }

  return {
    items: [
      { symbol: 'USD', name: 'Dólar', value: 'R$ 5,64', change: '+0,35%', isPositive: true },
      { symbol: 'EUR', name: 'Euro', value: 'R$ 6,18', change: '-0,12%', isPositive: false },
      { symbol: 'BTC', name: 'Bitcoin', value: 'R$ 358k', change: '+1,85%', isPositive: true }
    ],
    isLoading: false,
    lastUpdated: Date.now()
  };
}

export async function fetchSearchSuggestions(query: string, _engine: SearchEngineId): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`);
    if (res.ok) {
      const json = (await res.json()) as unknown;
      if (Array.isArray(json) && Array.isArray(json[1])) {
        return (json[1] as string[]).slice(0, 6);
      }
      if (Array.isArray(json)) {
        return (json as Array<{ phrase?: string }>)
          .map((item) => item?.phrase || '')
          .filter(Boolean)
          .slice(0, 6);
      }
    }
  } catch {
    // Ignore network offline
  }
  return [];
}
