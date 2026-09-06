/**
 * Réacteur arc animé, cœur visuel de l'interface.
 *
 * Il est composé d'anneaux dessinés en SVG et superposés, chacun tournant à sa
 * propre vitesse (classes `spin-slow`, `spin-fast`, `spin-reverse` définies dans
 * `src/styles.css`). Rien n'est interactif ici : c'est de la décoration.
 *
 * `thinking` = Jarvis prépare une réponse : le réacteur « respire » et le
 * sous-titre change.
 */
import { cn } from "@/lib/utils";

// Nombre d'éléments de chaque anneau (du plus externe au plus interne).
const ticks = Array.from({ length: 96 }, (_, i) => i);
const segments = Array.from({ length: 30 }, (_, i) => i);
const micro = Array.from({ length: 140 }, (_, i) => i);
const blocks = Array.from({ length: 18 }, (_, i) => i);

/** Convertit un angle en degrés en coordonnées x / y sur un cercle. */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
};

/** Chemin SVG d'un arc de cercle centré au milieu du dessin (200, 200). */
const arc = (r: number, start: number, end: number) => {
  const [x1, y1] = polar(200, 200, r, start);
  const [x2, y2] = polar(200, 200, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

/** Force la rotation autour du centre exact (nécessaire sur Safari). */
const spinStyle = {
  transformBox: "border-box",
  transformOrigin: "50% 50%",
} as const;

export function ArcReactor({ thinking = false }: { thinking?: boolean }) {
  return (
    <div
      className={cn(
        "reactor-mauve relative mx-auto aspect-square w-full max-w-155 transition-transform duration-700 ease-out",
        thinking && "hud-breathe",
      )}
    >
      {/* halos */}
      <div className="absolute inset-[20%] rounded-full bg-primary/20 blur-3xl hud-pulse" />
      <div className="absolute inset-[34%] rounded-full bg-accent/20 blur-2xl hud-pulse" />

      {/* anneau externe : micro-graduations */}
      <div className="spin-reverse absolute inset-0" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {micro.map((i) => {
            const deg = (i / micro.length) * 360;
            const [x1, y1] = polar(200, 200, 198, deg);
            const [x2, y2] = polar(200, 200, i % 5 === 0 ? 188 : 193, deg);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                className={i % 5 === 0 ? "text-accent/70" : "text-primary/25"}
                strokeWidth={i % 5 === 0 ? 1.6 : 0.7}
              />
            );
          })}
          <path
            d={arc(180, 12, 96)}
            fill="none"
            className="stroke-accent"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={arc(180, 200, 268)}
            fill="none"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx="200"
            cy="200"
            r="172"
            fill="none"
            className="stroke-primary/20"
            strokeWidth="1"
            strokeDasharray="1 7"
          />
        </svg>
      </div>

      {/* blocs de données */}
      <div className="spin-slow absolute inset-[5%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {blocks.map((i) => {
            const deg = (i / blocks.length) * 360;
            const [x, y] = polar(200, 200, 176, deg);
            return (
              <g key={i} transform={`rotate(${deg} ${x} ${y})`}>
                <rect
                  x={x - 11}
                  y={y - 4}
                  width={i % 3 === 0 ? 22 : 12}
                  height="8"
                  rx="1"
                  className={i % 3 === 0 ? "fill-accent/60" : "fill-primary/25"}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* anneau segmenté */}
      <div className="spin-fast absolute inset-[10%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {segments.map((i) => {
            const deg = (i / segments.length) * 360;
            const [x, y] = polar(200, 200, 160, deg);
            return (
              <rect
                key={i}
                x={x - 10}
                y={y - 6}
                width="20"
                height="12"
                rx="1.5"
                transform={`rotate(${deg} ${x} ${y})`}
                className={i % 4 === 0 ? "fill-primary/55" : "fill-primary/12"}
                stroke="currentColor"
                strokeWidth="0.7"
                style={{ color: "var(--hud-amber)", opacity: 0.85 }}
              />
            );
          })}
          <path
            d={arc(140, 150, 330)}
            fill="none"
            className="stroke-accent/70"
            strokeWidth="2"
            strokeDasharray="18 8"
          />
        </svg>
      </div>

      {/* anneau de ticks */}
      <div className="spin-reverse absolute inset-[18%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          {ticks.map((i) => {
            const deg = (i / ticks.length) * 360;
            const [x1, y1] = polar(200, 200, 138, deg);
            const [x2, y2] = polar(200, 200, i % 8 === 0 ? 114 : 126, deg);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                className={i % 8 === 0 ? "text-primary" : "text-primary/40"}
                strokeWidth={i % 8 === 0 ? 2.6 : 1.2}
              />
            );
          })}
        </svg>
      </div>

      {/* anneaux internes contra-rotatifs */}
      <div className="spin-slow absolute inset-[26%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            className="stroke-accent/40"
            strokeWidth="6"
            strokeDasharray="60 40"
            strokeLinecap="round"
          />
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            className="stroke-primary/50"
            strokeWidth="2"
            strokeDasharray="4 12"
          />
        </svg>
      </div>

      <div className="spin-fast absolute inset-[34%]" style={spinStyle}>
        <svg viewBox="0 0 400 400" className="block h-full w-full overflow-visible">
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            className="stroke-primary/70"
            strokeWidth="8"
            strokeDasharray="140 300"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* cœur */}
      <div className="absolute inset-[38%] rounded-full border border-accent/50 bg-[radial-gradient(circle,oklch(0.74_0.14_315/35%),oklch(0.66_0.15_295/12%)_55%,transparent_75%)]" />
      <div className="absolute inset-[44%] rounded-full border border-primary/70 hud-pulse" />

      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="font-display text-2xl font-black tracking-[0.35em] sm:text-3xl text-primary hud-glow">
          J.A.R.V.I.S
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          {thinking ? "Réflexion en cours" : "Système en ligne"}
        </p>
      </div>
    </div>
  );
}
