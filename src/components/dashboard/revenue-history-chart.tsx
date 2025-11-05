"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

type RevenueHistoryEntry = {
  month: string;
  amountCents: number;
};

type RevenueHistoryChartProps = {
  history: RevenueHistoryEntry[];
  currency: string;
};

const SVG_WIDTH = 960;
const SVG_HEIGHT = 320;
const MARGIN = { top: 32, right: 24, bottom: 48, left: 56 };
const INNER_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
const TOOLTIP_WIDTH = 192;
const TOOLTIP_HALF_PERCENT = (TOOLTIP_WIDTH / 2 / SVG_WIDTH) * 100;

type ChartPoint = {
  index: number;
  month: string;
  valueCents: number;
  x: number;
  y: number;
  ratioY: number;
  percentX: number;
};

const monthLabelFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
});

const tooltipDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

function buildSmoothPath(points: ChartPoint[]): string {
  if (!points.length) {
    return "";
  }
  if (points.length === 1) {
    const point = points[0];
    return [
      `M ${point.x} ${MARGIN.top + INNER_HEIGHT}`,
      `L ${point.x} ${point.y}`,
      `L ${point.x} ${MARGIN.top + INNER_HEIGHT}`,
      "Z",
    ].join(" ");
  }

  const commands: string[] = [
    `M ${points[0].x} ${MARGIN.top + INNER_HEIGHT}`,
    `L ${points[0].x} ${points[0].y}`,
  ];

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const controlX = (current.x + next.x) / 2;
    commands.push(
      `C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`,
    );
  }

  commands.push(
    `L ${points[points.length - 1]!.x} ${MARGIN.top + INNER_HEIGHT}`,
    "Z",
  );

  return commands.join(" ");
}

function buildLinePath(points: ChartPoint[]): string {
  if (!points.length) {
    return "";
  }
  if (points.length === 1) {
    const point = points[0]!;
    return `M ${point.x} ${point.y} L ${point.x + 0.001} ${point.y}`;
  }
  const commands = [`M ${points[0]!.x} ${points[0]!.y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const controlX = (current.x + next.x) / 2;
    commands.push(
      `C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`,
    );
  }
  return commands.join(" ");
}

function monthFromKey(value: string) {
  return new Date(`${value}-01T00:00:00Z`);
}

export function RevenueHistoryChart({
  history,
  currency,
}: RevenueHistoryChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(history.length - 1, 0),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveIndex(Math.max(history.length - 1, 0));
  }, [history]);

  const {
    points,
    totalCents,
    averageCents,
    maxCents,
    areaPath,
    linePath,
    horizontalGrid,
    verticalGrid,
  } = useMemo(() => {
    if (!history.length) {
      return {
        points: [] as ChartPoint[],
        totalCents: 0,
        averageCents: 0,
        maxCents: 0,
        areaPath: "",
        linePath: "",
        horizontalGrid: [] as number[],
        verticalGrid: [] as number[],
      };
    }

    const maxValue = Math.max(
      ...history.map((entry) => entry.amountCents),
      0,
    );
    const safeMax = Math.max(maxValue, 1);
    const total = history.reduce((acc, entry) => acc + entry.amountCents, 0);
    const average = Math.round(total / history.length);

    const computedPoints: ChartPoint[] = history.map((entry, index) => {
      const percentX =
        history.length === 1 ? 50 : (index / (history.length - 1)) * 100;
      const x =
        history.length === 1
          ? MARGIN.left + INNER_WIDTH / 2
          : MARGIN.left + (percentX / 100) * INNER_WIDTH;
      const ratioY = entry.amountCents / safeMax;
      const boundedRatio = Number.isFinite(ratioY) ? ratioY : 0;
      const y =
        MARGIN.top +
        INNER_HEIGHT -
        Math.max(0, Math.min(1, boundedRatio)) * INNER_HEIGHT;

      return {
        index,
        month: entry.month,
        valueCents: entry.amountCents,
        x,
        y,
        ratioY: Math.max(0, Math.min(1, boundedRatio)),
        percentX,
      };
    });

    const gridLines = [0.8, 0.6, 0.4, 0.2]
      .map((ratio) => parseFloat(ratio.toFixed(2)))
      .filter(
        (ratio, idx, arr) =>
          ratio > 0 &&
          Math.round(safeMax * ratio) > 0 &&
          arr.indexOf(ratio) === idx,
      );

    const area = buildSmoothPath(computedPoints);
    const line = buildLinePath(computedPoints);
    const verticalLines = computedPoints.map((point) => point.x);

    return {
      points: computedPoints,
      totalCents: total,
      averageCents: average,
      maxCents: maxValue,
      areaPath: area,
      linePath: line,
      horizontalGrid: gridLines,
      verticalGrid: verticalLines,
    };
  }, [history]);

  const activePoint = points[activeIndex] ?? null;

  const tooltip = useMemo(() => {
    if (!activePoint) return null;
    const monthDate = monthFromKey(activePoint.month);
    const label = tooltipDateFormatter.format(monthDate);
    const amount = formatCurrency(
      fromCents(activePoint.valueCents, currency),
      currency,
    );
    const baseLeftPercent = activePoint.percentX;
    const clampedLeftPercent = Math.min(
      100 - TOOLTIP_HALF_PERCENT,
      Math.max(TOOLTIP_HALF_PERCENT, baseLeftPercent),
    );
    const baseTopPercent = (1 - activePoint.ratioY) * 100;
    const clampedTopPercent = Math.min(88, Math.max(12, baseTopPercent));

    return {
      label,
      amount,
      valueCents: activePoint.valueCents,
      percentX: clampedLeftPercent,
      ratioY: activePoint.ratioY,
      topPercent: clampedTopPercent,
    };
  }, [activePoint, currency]);

  const formattedTotal = formatCurrency(
    fromCents(totalCents, currency),
    currency,
  );
  const formattedAverage = formatCurrency(
    fromCents(averageCents, currency),
    currency,
  );
  const formattedMax = formatCurrency(
    fromCents(maxCents, currency),
    currency,
  );

  const handlePointer = (clientX: number) => {
    if (!chartRef.current || !points.length) return;
    const { left, width } = chartRef.current.getBoundingClientRect();
    if (width <= 0) return;
    const relativeX = clientX - left;
    const normalized = Math.max(
      0,
      Math.min(1, relativeX / Math.max(width, 1)),
    );
    const index = Math.round(normalized * (points.length - 1));
    setActiveIndex(index);
  };

  return (
    <section className="card flex flex-col gap-6 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Évolution des encaissements (6 derniers mois)
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Suivez la cadence des encaissements récents et anticipez les pics
            d&apos;activité.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50/90 px-3 py-1 text-sm font-semibold text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/40">
            Total {formattedTotal}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Moyenne mensuelle {formattedAverage}
          </span>
        </div>
      </div>

      <div
        ref={chartRef}
        className="relative mt-3 w-full min-h-[18rem] select-none sm:min-h-[20rem] lg:min-h-[22rem]"
        onMouseMove={(event) => handlePointer(event.clientX)}
        onTouchMove={(event) => {
          if (event.touches?.[0]) {
            handlePointer(event.touches[0].clientX);
          }
        }}
        onTouchStart={(event) => {
          if (event.touches?.[0]) {
            handlePointer(event.touches[0].clientX);
          }
        }}
        onMouseLeave={() => setActiveIndex(Math.max(points.length - 1, 0))}
      >
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="revenue-area-gradient"
              x1="0%"
              x2="0%"
              y1="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
              <stop offset="60%" stopColor="rgba(59,130,246,0.18)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0.06)" />
            </linearGradient>
            <linearGradient
              id="revenue-line-gradient"
              x1="0%"
              x2="100%"
              y1="0%"
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(59,130,246,1)" />
              <stop offset="100%" stopColor="rgba(14,165,233,1)" />
            </linearGradient>
          </defs>

          <rect
            x="0"
            y="0"
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            rx={28}
            className="fill-white/60 dark:fill-zinc-950/70"
          />

          <g className="stroke-zinc-200/80 dark:stroke-zinc-800/80">
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + INNER_WIDTH}
              y1={MARGIN.top + INNER_HEIGHT}
              y2={MARGIN.top + INNER_HEIGHT}
              strokeWidth={1.5}
              strokeDasharray="3 6"
            />
          </g>

          <g className="stroke-zinc-200/60 dark:stroke-zinc-800/70">
            {horizontalGrid.map((ratio) => {
              const y =
                MARGIN.top + INNER_HEIGHT - ratio * INNER_HEIGHT;
              return (
                <line
                  key={`h-${ratio}`}
                  x1={MARGIN.left}
                  x2={MARGIN.left + INNER_WIDTH}
                  y1={y}
                  y2={y}
                  strokeWidth={1}
                  strokeDasharray="2 8"
                />
              );
            })}
          </g>

          <g className="stroke-zinc-200/40 dark:stroke-zinc-800/60">
            {verticalGrid.map((x, index) => (
              <line
                key={`v-${index}`}
                x1={x}
                x2={x}
                y1={MARGIN.top}
                y2={MARGIN.top + INNER_HEIGHT}
                strokeWidth={0.6}
                strokeDasharray="1 10"
              />
            ))}
          </g>

          {areaPath && (
            <path
              d={areaPath}
              className={clsx(
                "fill-[url(#revenue-area-gradient)] transition-opacity duration-700 ease-out",
                mounted ? "opacity-100" : "opacity-0",
              )}
            />
          )}

          {linePath && (
            <path
              d={linePath}
              className={clsx(
                "stroke-[url(#revenue-line-gradient)] stroke-[2.5] drop-shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition-transform duration-700 ease-out",
                mounted ? "translate-y-0" : "translate-y-4",
              )}
              fill="none"
            />
          )}

          {points.map((point) => (
            <circle
              key={`dot-${point.month}`}
              cx={point.x}
              cy={point.y}
              r={
                activePoint?.index === point.index
                  ? 6.5
                  : 4.25
              }
              className={clsx(
                "transition-all duration-300 ease-out",
                activePoint?.index === point.index
                  ? "fill-white stroke-[url(#revenue-line-gradient)] stroke-[2.5]"
                  : "fill-white/70 stroke-blue-400/70 stroke-[1.5]",
              )}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-x-6 bottom-3 flex justify-between text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {points.map((point) => {
            const date = monthFromKey(point.month);
            const monthLabel = monthLabelFormatter
              .format(date)
              .replace(".", "");
            const yearLabel = date.getUTCFullYear().toString().slice(-2);
            return (
              <div
                key={`label-${point.month}`}
                className="flex min-w-12 flex-col items-center gap-0.5"
              >
                <span>{monthLabel}</span>
                <span className="text-[10px] font-semibold text-zinc-300 dark:text-zinc-600">
                  {yearLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {tooltip && (
            <div
              className="absolute flex w-48 flex-col items-center transition-all duration-200 ease-out"
              style={{
                left: `${tooltip.percentX}%`,
                top: `${tooltip.topPercent}%`,
                transform: "translate(-50%, -100%) translateY(-16px)",
              }}
            >
              <div className="w-full rounded-2xl border border-blue-100/50 bg-white/95 p-3 text-sm text-zinc-700 shadow-xl shadow-blue-500/10 ring-1 ring-blue-100/40 backdrop-blur-md dark:border-blue-400/30 dark:bg-zinc-900/95 dark:text-zinc-100 dark:ring-blue-400/30">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-300">
                  {tooltip.label}
                </span>
                <span className="mt-1 block text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {tooltip.amount}
                </span>
              </div>
              <div className="mt-1 h-2 w-2 rotate-45 rounded-[2px] border border-blue-100/40 bg-white/95 shadow-sm shadow-blue-200/30 dark:border-blue-400/30 dark:bg-zinc-900/95 dark:shadow-blue-400/20" />
            </div>
          )}
        </div>

        <div
          className="absolute inset-0 cursor-pointer"
          role="presentation"
        >
          {points.map((point) => (
            <button
              key={`button-${point.month}`}
              type="button"
              className="absolute top-0 h-full -translate-x-1/2 rounded-sm border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400/60 dark:focus-visible:ring-offset-zinc-950"
              style={{
                left: `${point.percentX}%`,
                width: `${100 / Math.max(points.length, 1)}%`,
              }}
              onFocus={() => setActiveIndex(point.index)}
              onMouseEnter={() => setActiveIndex(point.index)}
            >
              <span className="sr-only">
                {tooltipDateFormatter.format(monthFromKey(point.month))} :{" "}
                {formatCurrency(
                  fromCents(point.valueCents, currency),
                  currency,
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-8 items-center gap-2 rounded-full bg-blue-500/10 px-3 text-[11px] font-semibold uppercase tracking-wide text-blue-500 dark:bg-blue-500/20 dark:text-blue-200">
            Pic {formattedMax}
          </div>
          <p>
            Les valeurs sont basées sur les factures encaissées et
            exprimées en montant TTC.
          </p>
        </div>
        <p>
          Passez la souris ou naviguez au clavier pour explorer chaque
          mois.
        </p>
      </div>
    </section>
  );
}
