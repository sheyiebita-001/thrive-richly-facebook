import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { evolvePath } from "@remotion/paths";
import { SPRING_SMOOTH, STAGGER_DELAY_FRAMES, FONT_SIZES } from "../constants";
import type { ChartDataPoint } from "../schemas";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// === BarChart ===
export const BarChart: React.FC<{ data: ChartDataPoint[]; title?: string; accentColor?: string; delay?: number }> = ({
  data, title, accentColor = "#3b82f6", delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxVal = Math.max(...data.map(d => d.value));
  const W = 1200, H = 500, GAP = 16;
  const barW = (W - GAP * (data.length + 1)) / data.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      {title && <div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{title}</div>}
      <svg width={W} height={H + 60} viewBox={`0 0 ${W} ${H + 60}`}>
        {data.map((item, i) => {
          const h = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES, config: SPRING_SMOOTH }) * (item.value / maxVal) * H;
          const x = GAP + i * (barW + GAP);
          const labelOp = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES + 10, config: SPRING_SMOOTH });
          return (
            <g key={item.label}>
              <rect x={x} y={H - h} width={barW} height={h} fill={item.color || accentColor} rx={6} />
              <text x={x + barW / 2} y={H - h - 10} textAnchor="middle" fill="white" fontSize={20} fontWeight={600} opacity={labelOp}>{item.value}</text>
              <text x={x + barW / 2} y={H + 30} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={18} opacity={labelOp}>{item.label}</text>
            </g>
          );
        })}
        <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      </svg>
    </div>
  );
};

// === LineChart ===
export const LineChart: React.FC<{ data: ChartDataPoint[]; title?: string; accentColor?: string; delay?: number }> = ({
  data, title, accentColor = "#3b82f6", delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const range = maxVal - minVal || 1;
  const PAD = { top: 20, right: 40, bottom: 60, left: 60 };
  const W = 1200, H = 450;
  const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;

  const points = data.map((item, i) => ({
    x: PAD.left + (i / (data.length - 1)) * iW,
    y: PAD.top + iH - ((item.value - minVal) / range) * iH,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const progress = spring({ frame, fps, delay, config: SPRING_SMOOTH });
  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, pathD);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {title && <div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{title}</div>}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={PAD.left} y1={PAD.top + iH * (1 - p)} x2={W - PAD.right} y2={PAD.top + iH * (1 - p)} stroke="rgba(255,255,255,0.08)" />
        ))}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth={4} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
        {points.map((p, i) => {
          const dp = spring({ frame, fps, delay: delay + 15 + i * 4, config: SPRING_SMOOTH });
          return (
            <g key={data[i].label}>
              <circle cx={p.x} cy={p.y} r={interpolate(dp, [0, 1], [0, 6])} fill={accentColor} />
              <text x={p.x} y={H - 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={16} opacity={dp}>{data[i].label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// === PieChart ===
export const PieChart: React.FC<{ data: ChartDataPoint[]; title?: string; delay?: number }> = ({ data, title, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 160, C = 200, SW = 50, circ = 2 * Math.PI * R;
  let cumOffset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {title && <div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{title}</div>}
        <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`}>
          {data.map((item, i) => {
            const segLen = (item.value / total) * circ;
            const color = item.color || COLORS[i % COLORS.length];
            const p = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES * 2, config: SPRING_SMOOTH });
            const dashOff = interpolate(p, [0, 1], [segLen, 0]);
            const rot = (cumOffset / circ) * 360 - 90;
            cumOffset += segLen;
            return <circle key={item.label} r={R} cx={C} cy={C} fill="none" stroke={color} strokeWidth={SW} strokeDasharray={`${segLen} ${circ}`} strokeDashoffset={dashOff} transform={`rotate(${rot} ${C} ${C})`} />;
          })}
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {data.map((item, i) => {
          const color = item.color || COLORS[i % COLORS.length];
          const lp = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES * 2 + 5, config: SPRING_SMOOTH });
          return (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, opacity: lp }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 22, color: "rgba(255,255,255,0.8)" }}>{item.label} ({Math.round((item.value / total) * 100)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
