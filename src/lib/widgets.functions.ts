/**
 * Données des modules latéraux (météo, cryptomonnaies, bourse).
 *
 * Ces fonctions s'exécutent sur le serveur (`createServerFn`) et non dans le
 * navigateur. Avantages : aucune clé exposée, et les services qui refusent les
 * appels directs depuis une page web fonctionnent quand même.
 *
 * Toutes les sources utilisées ici sont gratuites et sans inscription.
 */
import { createServerFn } from "@tanstack/react-start";

// ---------------------------------------------------------------- Types

/** Prévision d'une journée. */
export type DailyForecast = {
  /** Date au format AAAA-MM-JJ. */
  date: string;
  /** Code météo Open-Meteo (0 = ciel clair, 95+ = orage…). */
  code: number;
  min: number;
  max: number;
};

/** Météo actuelle + prévisions de la semaine. */
export type WeatherData = {
  city: string;
  temp: number;
  code: number;
  /** Vent en km/h. */
  wind: number;
  daily: DailyForecast[];
};

/** Une ligne de cours (crypto, indice ou action). */
export type Quote = {
  symbol: string;
  label: string;
  price: number;
  /** Variation en pourcentage. */
  change: number;
};

// ---------------------------------------------------------------- Météo

/** Ville affichée par défaut : Bruxelles. */
const CITY = { name: "Bruxelles", latitude: 50.85, longitude: 4.35 };

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CITY.latitude}&longitude=${CITY.longitude}` +
  "&current=temperature_2m,weather_code,wind_speed_10m" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
  "&timezone=Europe%2FBrussels&forecast_days=7";

/** Forme de la réponse d'Open-Meteo, réduite à ce que l'on utilise. */
type OpenMeteoResponse = {
  current: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
};

/** Météo du jour et prévisions sur 7 jours (source : Open-Meteo, gratuite). */
export const getWeather = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeatherData> => {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error("Météo indisponible");

    const json = (await res.json()) as OpenMeteoResponse;

    // Open-Meteo renvoie des tableaux parallèles : on les recompose par jour.
    const d = json.daily;
    const daily: DailyForecast[] = d
      ? d.time.map((date, i) => ({
          date,
          code: d.weather_code[i] ?? 0,
          max: Math.round(d.temperature_2m_max[i] ?? 0),
          min: Math.round(d.temperature_2m_min[i] ?? 0),
        }))
      : [];

    return {
      city: CITY.name,
      temp: Math.round(json.current.temperature_2m),
      code: json.current.weather_code,
      wind: Math.round(json.current.wind_speed_10m),
      daily,
    };
  },
);

// ------------------------------------------------------------ Cryptomonnaies

/** Identifiant CoinGecko → nom court affiché. */
const CRYPTO_MAP: Array<[string, string]> = [
  ["bitcoin", "BTC"],
  ["ethereum", "ETH"],
  ["solana", "SOL"],
  ["binancecoin", "BNB"],
  ["ripple", "XRP"],
  ["cardano", "ADA"],
  ["dogecoin", "DOGE"],
  ["polkadot", "DOT"],
  ["avalanche-2", "AVAX"],
  ["chainlink", "LINK"],
  ["litecoin", "LTC"],
  ["tron", "TRX"],
];

/** Cours en euros et variation sur 24 h (source : CoinGecko, gratuite). */
async function fetchCrypto(): Promise<Quote[]> {
  const ids = CRYPTO_MAP.map(([id]) => id).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`,
  );
  if (!res.ok) return [];

  const json = (await res.json()) as Record<string, { eur: number; eur_24h_change: number }>;

  // On ne garde que les monnaies effectivement renvoyées, dans notre ordre.
  return CRYPTO_MAP.filter(([id]) => json[id]).map(([id, label]) => ({
    symbol: label,
    label,
    price: json[id]!.eur,
    change: json[id]!.eur_24h_change ?? 0,
  }));
}

// ----------------------------------------------------------------- Bourse

/** Symbole Yahoo Finance → nom affiché (les `^` désignent des indices). */
const STOCK_MAP: Array<[string, string]> = [
  ["^GSPC", "S&P 500"],
  ["^IXIC", "NASDAQ"],
  ["^GDAXI", "DAX"],
  ["^FCHI", "CAC 40"],
  ["^BFX", "BEL 20"],
  ["^STOXX50E", "EuroStoxx"],
  ["^FTSE", "FTSE 100"],
  ["^N225", "Nikkei"],
  ["AAPL", "Apple"],
  ["MSFT", "Microsoft"],
  ["NVDA", "Nvidia"],
  ["TSLA", "Tesla"],
];

/**
 * Cours des indices et actions (source : Yahoo Finance, gratuite).
 *
 * Un appel par symbole, tous lancés en parallèle. Un symbole en échec est
 * simplement ignoré : le module reste utilisable avec les autres valeurs.
 */
async function fetchStocks(): Promise<Quote[]> {
  const results = await Promise.all(
    STOCK_MAP.map(async ([symbol, label]) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
          // Yahoo refuse les requêtes sans navigateur déclaré.
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        if (!res.ok) return null;

        const json = (await res.json()) as {
          chart?: {
            result?: Array<{
              meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number };
            }>;
          };
        };

        const meta = json.chart?.result?.[0]?.meta;
        if (!meta || typeof meta.regularMarketPrice !== "number") return null;

        return {
          symbol,
          label,
          price: meta.regularMarketPrice,
          change: meta.regularMarketChangePercent ?? 0,
        } satisfies Quote;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((q): q is Quote => q !== null);
}

/**
 * Cryptos et bourse en un seul appel.
 * Si une source tombe, l'autre continue d'être affichée.
 */
export const getMarkets = createServerFn({ method: "GET" }).handler(async () => {
  const [crypto, stocks] = await Promise.all([
    fetchCrypto().catch(() => [] as Quote[]),
    fetchStocks().catch(() => [] as Quote[]),
  ]);
  return { crypto, stocks };
});
