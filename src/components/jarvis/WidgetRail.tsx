/**
 * Les quatre modules affichés sur les côtés de l'écran.
 *
 *   colonne gauche : Météo, Agenda
 *   colonne droite : Cryptos, Bourse
 *
 * Chaque module suit le même principe : une vignette compacte (`Card`) qui, au
 * clic, ouvre une fenêtre détaillée (`Modal`).
 *
 * Origine des données :
 * - météo, cryptos et bourse viennent du serveur (`src/lib/widgets.functions.ts`),
 *   et sont rafraîchies automatiquement ;
 * - l'agenda est privé : il reste enregistré dans le navigateur.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Bitcoin,
  CalendarDays,
  Cloud,
  CloudRain,
  CloudSnow,
  LineChart,
  Plus,
  Sun,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readJson, writeJson } from "@/lib/local-storage";
import { getMarkets, getWeather } from "@/lib/widgets.functions";
import { cn } from "@/lib/utils";

/** Clé de sauvegarde de l'agenda dans le navigateur. */
const AGENDA_KEY = "jarvis-agenda-v1";

/** Fréquence de rafraîchissement des données (ms). */
const WEATHER_REFRESH = 15 * 60 * 1000;
const MARKETS_REFRESH = 5 * 60 * 1000;

/** Nombre de lignes visibles dans une vignette. */
const PREVIEW_ROWS = 5;

/** Un rendez-vous noté par l'utilisateur. */
type AgendaItem = { id: string; date: string; title: string };

// ------------------------------------------------------- Briques communes

/**
 * Vignette d'un module : titre, icône et contenu de hauteur fixe.
 * Avec `onOpen`, la vignette entière devient cliquable.
 */
function Card({
  title,
  icon,
  children,
  onOpen,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <header className="mb-2 flex items-center gap-2 border-b border-primary/20 pb-1.5">
        <span className="text-primary">{icon}</span>
        <h2 className="font-display text-[9px] font-semibold uppercase tracking-[0.3em] text-primary">
          {title}
        </h2>
      </header>
      {/* Hauteur figée : les quatre modules restent alignés. */}
      <div className="h-28 overflow-hidden">{children}</div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="hud-panel w-full p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        {content}
      </button>
    );
  }

  return <section className="hud-panel p-3">{content}</section>;
}

/** Fenêtre détaillée, avec l'animation d'ouverture façon HUD. */
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-panel hud-modal-in max-h-[80vh] overflow-y-auto sm:max-w-lg">
        {/* Balayage lumineux purement décoratif. */}
        <span className="hud-sweep" aria-hidden="true" />
        <DialogHeader>
          <DialogTitle className="font-display text-sm uppercase tracking-[0.3em] text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[11px] uppercase tracking-[0.2em]">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Météo

/** Choisit l'icône correspondant au code météo d'Open-Meteo. */
function weatherIcon(code: number, className = "h-6 w-6") {
  if (code === 0 || code === 1) return <Sun className={className} />; // ciel clair
  if (code >= 95) return <Zap className={className} />; // orage
  if (code >= 71 && code <= 77) return <CloudSnow className={className} />; // neige
  if (code >= 51) return <CloudRain className={className} />; // pluie
  return <Cloud className={className} />; // nuages
}

function WeatherWidget() {
  const [open, setOpen] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["weather"],
    queryFn: () => getWeather(),
    refetchInterval: WEATHER_REFRESH,
  });

  return (
    <>
      <Card title="Météo" icon={<Cloud className="h-3.5 w-3.5" />} onOpen={() => setOpen(true)}>
        {isError ? (
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Hors ligne</p>
        ) : !data ? (
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
            Relevé…
          </p>
        ) : (
          <div className="space-y-2">
            {/* Température actuelle, ville et vent */}
            <div className="flex items-center gap-3">
              <span className="text-primary">{weatherIcon(data.code)}</span>
              <div className="min-w-0">
                <p className="font-display text-xl font-bold leading-none text-foreground">
                  {data.temp}°
                </p>
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {data.city}
                </p>
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Wind className="h-3 w-3" />
                {data.wind}
              </span>
            </div>

            {/* Maximum et minimum du jour */}
            {data.daily[0] ? (
              <div className="mt-2 flex items-center gap-2 border-t border-primary/15 pt-2">
                <span className="text-primary">{weatherIcon(data.daily[0].code, "h-4 w-4")}</span>
                <span className="font-display text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  Aujourd'hui
                </span>
                <span className="ml-auto flex items-center gap-2 font-display text-[11px] tabular-nums">
                  <span className="text-foreground">{data.daily[0].max}°</span>
                  <span className="text-muted-foreground">{data.daily[0].min}°</span>
                </span>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Météo — 7 jours"
        description={data?.city ?? "Relevé en cours"}
      >
        <div className="hud-stagger space-y-1">
          {(data?.daily ?? []).map((d) => (
            <div
              key={d.date}
              className="flex items-center gap-3 border-b border-primary/10 py-2 text-[12px] last:border-0"
            >
              <span className="w-24 shrink-0 font-display uppercase tracking-widest text-muted-foreground">
                {new Date(d.date).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
              <span className="text-primary">{weatherIcon(d.code, "h-4 w-4")}</span>
              <span className="ml-auto tabular-nums text-foreground">{d.max}°</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{d.min}°</span>
            </div>
          ))}
          {!data && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
              Relevé…
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------- Agenda

/**
 * Date au format AAAA-MM-JJ, calculée en heure locale.
 * (`toISOString()` est évité : il décale la date selon le fuseau horaire.)
 */
function toKey(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Cases du calendrier d'un mois, semaine commençant le lundi. */
function monthCells(cursor: Date): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  // Cases vides avant le 1er du mois (lundi = 0).
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
}

function AgendaWidget() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  /** Mois affiché dans le calendrier. */
  const [cursor, setCursor] = useState(() => new Date());
  /** Jour sélectionné (AAAA-MM-JJ). */
  const [selected, setSelected] = useState(() => toKey(new Date()));

  // Chargement après l'affichage : le stockage n'existe que dans le navigateur.
  useEffect(() => {
    const saved = readJson<AgendaItem[]>(AGENDA_KEY, []);
    if (Array.isArray(saved)) setItems(saved);
  }, []);

  /** Enregistre la liste triée par date. */
  const persist = (next: AgendaItem[]) => {
    const sorted = [...next].sort((a, b) => a.date.localeCompare(b.date));
    setItems(sorted);
    writeJson(AGENDA_KEY, sorted);
  };

  const add = () => {
    if (!title.trim() || !selected) return;
    persist([...items, { id: crypto.randomUUID(), date: selected, title: title.trim() }]);
    setTitle("");
  };

  const todayKey = toKey(new Date());
  /** Prochains rendez-vous affichés dans la vignette. */
  const upcoming = items.filter((i) => i.date >= todayKey).slice(0, PREVIEW_ROWS);
  /** Rendez-vous du jour sélectionné. */
  const dayItems = items.filter((i) => i.date === selected);
  const cells = monthCells(cursor);

  return (
    <>
      <Card
        title="Agenda"
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        onOpen={() => setOpen(true)}
      >
        <div className="space-y-1.5">
          {upcoming.length === 0 ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Aucun rendez-vous
            </p>
          ) : (
            upcoming.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-[11px]">
                <span className="shrink-0 font-display tabular-nums text-primary">
                  {new Date(item.date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
              </div>
            ))
          )}
          <span className="flex items-center gap-1 pt-0.5 font-display text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
            <Plus className="h-3 w-3" />
            Ouvrir le calendrier
          </span>
        </div>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Agenda"
        description="Sélectionnez un jour puis notez le rendez-vous"
      >
        <div className="space-y-4">
          {/* Navigation entre les mois */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="px-2 font-display text-primary transition-opacity hover:opacity-70"
            >
              ‹
            </button>
            <span className="font-display text-[11px] uppercase tracking-[0.3em] text-primary">
              {cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="px-2 font-display text-primary transition-opacity hover:opacity-70"
            >
              ›
            </button>
          </div>

          {/* Grille du mois : un point sous les jours qui ont un rendez-vous */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="font-display text-[9px] uppercase tracking-widest text-muted-foreground"
              >
                {d}
              </span>
            ))}

            {cells.map((d, i) => {
              if (!d) return <span key={`vide-${i}`} />;
              const key = toKey(d);
              const count = items.filter((it) => it.date === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "relative aspect-square rounded-sm border text-[11px] tabular-nums transition-colors",
                    key === selected
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-primary/15 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    key === todayKey && key !== selected && "text-primary",
                  )}
                >
                  {d.getDate()}
                  {count > 0 && (
                    <span className="absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rendez-vous du jour choisi + ajout */}
          <div className="space-y-2 border-t border-primary/20 pt-3">
            <p className="font-display text-[10px] uppercase tracking-[0.25em] text-primary">
              {new Date(selected).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>

            {dayItems.length === 0 ? (
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Aucun rendez-vous
              </p>
            ) : (
              dayItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                  <button
                    type="button"
                    onClick={() => persist(items.filter((i) => i.id !== item.id))}
                    aria-label="Supprimer"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Nouveau rendez-vous…"
                className="min-w-0 flex-1 border-b border-primary/30 bg-transparent py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={add}
                className="shrink-0 font-display text-[10px] uppercase tracking-widest text-primary transition-opacity hover:opacity-70"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

// --------------------------------------------------------- Cryptos & bourse

/** Une ligne de cours : nom, prix, variation (verte à la hausse). */
function QuoteRow({
  quote,
  currency,
}: {
  quote: { label: string; price: number; change: number };
  currency?: string;
}) {
  const up = quote.change >= 0;
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="w-20 shrink-0 truncate font-display uppercase text-muted-foreground">
        {quote.label}
      </span>
      <span className="min-w-0 flex-1 truncate tabular-nums text-foreground">
        {quote.price.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        {currency ? ` ${currency}` : ""}
      </span>
      <span className={cn("shrink-0 tabular-nums", up ? "text-primary" : "text-destructive")}>
        {up ? "+" : ""}
        {quote.change.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * Cryptos et bourse arrivent ensemble : les deux modules partagent la même
 * requête, donc un seul appel réseau pour les deux.
 */
function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => getMarkets(),
    refetchInterval: MARKETS_REFRESH,
  });
}

function CryptoWidget() {
  const [open, setOpen] = useState(false);
  const { data, isError } = useMarkets();

  return (
    <>
      <Card title="Cryptos" icon={<Bitcoin className="h-3.5 w-3.5" />} onOpen={() => setOpen(true)}>
        <div className="space-y-1">
          {isError ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Hors ligne
            </p>
          ) : !data ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
              Flux…
            </p>
          ) : (
            data.crypto
              .slice(0, PREVIEW_ROWS)
              .map((q) => <QuoteRow key={q.symbol} quote={q} currency="€" />)
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Cryptomonnaies"
        description="Cours en euros, variation sur 24 h"
      >
        <div className="hud-stagger space-y-2">
          {(data?.crypto ?? []).map((q) => (
            <QuoteRow key={q.symbol} quote={q} currency="€" />
          ))}
          {!data && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
              Flux…
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

function StocksWidget() {
  const [open, setOpen] = useState(false);
  const { data, isError } = useMarkets();

  return (
    <>
      <Card
        title="Bourse"
        icon={<LineChart className="h-3.5 w-3.5" />}
        onOpen={() => setOpen(true)}
      >
        <div className="space-y-1">
          {isError ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Hors ligne
            </p>
          ) : !data ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
              Flux…
            </p>
          ) : data.stocks.length === 0 ? (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Marchés fermés
            </p>
          ) : (
            data.stocks.slice(0, PREVIEW_ROWS).map((q) => <QuoteRow key={q.symbol} quote={q} />)
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Bourse"
        description="Indices et valeurs, variation du jour"
      >
        <div className="hud-stagger space-y-2">
          {(data?.stocks ?? []).map((q) => (
            <QuoteRow key={q.symbol} quote={q} />
          ))}
          {!data && (
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground hud-pulse">
              Flux…
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

/** Une colonne de modules : météo + agenda à gauche, marchés à droite. */
export function WidgetColumn({ side, className }: { side: "left" | "right"; className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {side === "left" ? (
        <>
          <WeatherWidget />
          <AgendaWidget />
        </>
      ) : (
        <>
          <CryptoWidget />
          <StocksWidget />
        </>
      )}
    </div>
  );
}
