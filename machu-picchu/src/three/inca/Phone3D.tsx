import React, { useMemo } from "react";
import * as THREE from "three";
import { V3, canvasTexture, glowTexture, planarUV, roundedRectShape, toy, useFontsReady, useRounded } from "./kit";

// A modern (brand-free) smartphone: 1 tall x 0.5 wide x 0.05 deep at scale 1, origin at its
// centre, screen facing +z. Screens are drawn on a canvas per variant: an original look (the
// "Chaski" chat app with an orange header and a llama logo, a "PapaBot" weather app, a quipu
// notes app...), no real brands, logos or exact UIs.

export type PhoneScreen = "home" | "chat" | "notifs" | "camera" | "weather" | "off";
export type ChatMessage = { from: "me" | "them"; text?: string; location?: boolean };

const DEFAULT_CHAT: ChatMessage[] = [
  { from: "them", text: "¡Mi Inca, noticias urgentes!" },
  { from: "them", text: "Hay un problema en el norte" },
  { from: "me", text: "¡Entonces manda tu ubicación, pues!" },
  { from: "them", location: true },
];

// Screen canvas in logical pixels (the 0.46 x 0.96 screen); `res` multiplies it.
const SW = 512;
const SH = 1068;
const FUN = "'Lilita One', 'Montserrat', sans-serif";
const SANS = "Montserrat, 'DejaVu Sans', sans-serif";

type Ctx = CanvasRenderingContext2D;

const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const circle = (ctx: Ctx, x: number, y: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const text = (
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  align: CanvasTextAlign = "left",
  shadow = false,
) => {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillText(s, x + 2, y + 3);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
};

/** Status bar: time, punch-hole camera, signal and battery. */
const statusBar = (ctx: Ctx, color: string) => {
  text(ctx, "10:30", 34, 36, `700 26px ${SANS}`, color);
  circle(ctx, SW / 2, 36, 13, "#05070A");
  for (let i = 0; i < 4; i++) rr(ctx, 382 + i * 11, 44 - (i + 1) * 6, 7, (i + 1) * 6, 2, color);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(436, 25, 44, 22, 6);
  ctx.stroke();
  rr(ctx, 440, 29, 30, 14, 3, color);
  rr(ctx, 482, 31, 4, 10, 2, color);
};

// --- Glyphs (original, simple shapes) ---------------------------------------------------

const llamaGlyph = (ctx: Ctx, cx: number, cy: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.2, cy - s * 0.05, s * 0.3, s * 0.55, s * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.24, cy - s * 0.34, s * 0.5, s * 0.34, s * 0.15);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.12, cy - s * 0.44, s * 0.06, s * 0.16, -0.15, 0, Math.PI * 2);
  ctx.ellipse(cx + s * 0.06, cy - s * 0.44, s * 0.06, s * 0.16, 0.15, 0, Math.PI * 2);
  ctx.fill();
  rr(ctx, cx + s * 0.02, cy - s * 0.25, s * 0.06, s * 0.1, s * 0.03, "rgba(0,0,0,0.75)");
};

const quipuGlyph = (ctx: Ctx, cx: number, cy: number, s: number, colors: string[]) => {
  ctx.lineCap = "round";
  ctx.strokeStyle = "#FFF6E3";
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, cy - s * 0.26);
  ctx.quadraticCurveTo(cx, cy - s * 0.18, cx + s * 0.36, cy - s * 0.26);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const x = cx - s * 0.24 + i * s * 0.16;
    const len = s * (0.38 + ((i * 7) % 3) * 0.08);
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = s * 0.055;
    ctx.beginPath();
    ctx.moveTo(x, cy - s * 0.2);
    ctx.lineTo(x, cy - s * 0.2 + len);
    ctx.stroke();
    circle(ctx, x, cy - s * 0.02 + (i % 2) * s * 0.12, s * 0.06, colors[i % colors.length]);
  }
};

const sunGlyph = (ctx: Ctx, cx: number, cy: number, r: number, color: string) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
    ctx.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75);
    ctx.stroke();
  }
  circle(ctx, cx, cy, r, color);
};

const cloudGlyph = (ctx: Ctx, cx: number, cy: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - s * 0.28, cy + s * 0.05, s * 0.22, 0, Math.PI * 2);
  ctx.arc(cx, cy - s * 0.1, s * 0.3, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.3, cy + s * 0.04, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.5, cy + s * 0.02, s * 1.0, s * 0.25, s * 0.12);
  ctx.fill();
};

const potatoGlyph = (ctx: Ctx, cx: number, cy: number, s: number) => {
  ctx.fillStyle = "#C98E4E";
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.42, s * 0.32, -0.1, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, cx - s * 0.2, cy + s * 0.12, s * 0.03, "#8A5A2B");
  circle(ctx, cx + s * 0.26, cy - s * 0.1, s * 0.025, "#8A5A2B");
  rr(ctx, cx - s * 0.13, cy - s * 0.12, s * 0.07, s * 0.14, s * 0.03, "#1A1410");
  rr(ctx, cx + s * 0.06, cy - s * 0.12, s * 0.07, s * 0.14, s * 0.03, "#1A1410");
  ctx.fillStyle = "rgba(255,120,150,0.7)";
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.22, cy + 0.02 * s, s * 0.06, s * 0.035, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + s * 0.23, cy + 0.02 * s, s * 0.06, s * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
};

const pinGlyph = (ctx: Ctx, cx: number, cy: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.24, Math.PI * 0.85, Math.PI * 0.15);
  ctx.lineTo(cx, cy + s * 0.34);
  ctx.closePath();
  ctx.fill();
  circle(ctx, cx, cy - s * 0.12, s * 0.09, "#FFFFFF");
};

const mountainGlyph = (ctx: Ctx, cx: number, cy: number, s: number) => {
  circle(ctx, cx + s * 0.22, cy - s * 0.2, s * 0.1, "#FFC21A");
  ctx.fillStyle = "#2FA35B";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, cy + s * 0.28);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.18);
  ctx.lineTo(cx + s * 0.08, cy + s * 0.05);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.42, cy + s * 0.28);
  ctx.closePath();
  ctx.fill();
};

const noteGlyph = (ctx: Ctx, cx: number, cy: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.14, cy + s * 0.2, s * 0.12, s * 0.09, -0.4, 0, Math.PI * 2);
  ctx.ellipse(cx + s * 0.2, cy + s * 0.12, s * 0.12, s * 0.09, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s * 0.05, cy - s * 0.3, s * 0.05, s * 0.5);
  ctx.fillRect(cx + s * 0.29, cy - s * 0.38, s * 0.05, s * 0.5);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.05, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.34, cy - s * 0.38);
  ctx.lineTo(cx + s * 0.34, cy - s * 0.26);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.18);
  ctx.fill();
};

const cameraGlyph = (ctx: Ctx, cx: number, cy: number, s: number) => {
  rr(ctx, cx - s * 0.36, cy - s * 0.2, s * 0.72, s * 0.46, s * 0.1, "#F2F2F2");
  rr(ctx, cx - s * 0.12, cy - s * 0.3, s * 0.24, s * 0.14, s * 0.05, "#F2F2F2");
  circle(ctx, cx, cy + s * 0.03, s * 0.15, "#2A2F3A");
  circle(ctx, cx, cy + s * 0.03, s * 0.08, "#5B8CFF");
};

const callGlyph = (ctx: Ctx, cx: number, cy: number, s: number) => {
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.22, s * 0.36, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  rr(ctx, cx - s * 0.4, cy - s * 0.02, s * 0.2, s * 0.14, s * 0.05, "#FFFFFF");
  rr(ctx, cx + s * 0.2, cy - s * 0.02, s * 0.2, s * 0.14, s * 0.05, "#FFFFFF");
};

const houseGlyph = (ctx: Ctx, cx: number, cy: number, s: number) => {
  ctx.fillStyle = "#FFF3DA";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, cy - s * 0.02);
  ctx.lineTo(cx, cy - s * 0.34);
  ctx.lineTo(cx + s * 0.36, cy - s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - s * 0.26, cy - s * 0.04, s * 0.52, s * 0.34);
  rr(ctx, cx - s * 0.08, cy + s * 0.06, s * 0.16, s * 0.24, s * 0.03, "#B5462A");
};

type App = { name: string; bg: [string, string]; draw: (ctx: Ctx, cx: number, cy: number, s: number) => void };

const APPS: App[] = [
  { name: "Chaski", bg: ["#FF8A3D", "#E8342A"], draw: (c, x, y, s) => llamaGlyph(c, x, y + s * 0.06, s * 0.78, "#FFFFFF") },
  { name: "Quipu", bg: ["#2BC4B4", "#12867C"], draw: (c, x, y, s) => quipuGlyph(c, x, y, s * 0.9, ["#FFC21A", "#FF5B5B", "#FFFFFF", "#7CFF9B"]) },
  { name: "Clima", bg: ["#63C3FF", "#2A73E8"], draw: (c, x, y, s) => { sunGlyph(c, x - s * 0.12, y - s * 0.1, s * 0.13, "#FFD23F"); cloudGlyph(c, x + s * 0.04, y + s * 0.06, s * 0.6, "#FFFFFF"); } },
  { name: "PapaBot", bg: ["#FFE08A", "#F2A93B"], draw: (c, x, y, s) => potatoGlyph(c, x, y + s * 0.04, s * 0.95) },
  { name: "Cámara", bg: ["#4A5160", "#232833"], draw: cameraGlyph },
  { name: "Mapa", bg: ["#7EE08A", "#2E9E4F"], draw: (c, x, y, s) => pinGlyph(c, x, y, s * 0.9, "#FF3B30") },
  { name: "Fotos", bg: ["#FFFFFF", "#DDE6F2"], draw: mountainGlyph },
  { name: "Quena", bg: ["#B07CFF", "#6A3DE8"], draw: (c, x, y, s) => noteGlyph(c, x, y, s * 0.85, "#FFFFFF") },
  { name: "Inti", bg: ["#FFD23F", "#FF9F0A"], draw: (c, x, y, s) => sunGlyph(c, x, y, s * 0.16, "#FFFFFF") },
  { name: "Tambo", bg: ["#FF9E7A", "#D9573A"], draw: houseGlyph },
  { name: "Llamar", bg: ["#56E07A", "#1FA35B"], draw: callGlyph },
  { name: "Mercado", bg: ["#FF6FA8", "#D6337A"], draw: (c, x, y, s) => { rr(c, x - s * 0.3, y - s * 0.12, s * 0.6, s * 0.42, s * 0.1, "#FFFFFF"); c.strokeStyle = "#FFFFFF"; c.lineWidth = s * 0.07; c.beginPath(); c.arc(x, y - s * 0.12, s * 0.16, Math.PI, 0); c.stroke(); } },
];

const appIcon = (ctx: Ctx, app: App, x: number, y: number, s: number, label: string | null, badge = 0) => {
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, app.bg[0]);
  g.addColorStop(1, app.bg[1]);
  rr(ctx, x + 2, y + 5, s, s, s * 0.26, "rgba(0,0,0,0.18)");
  rr(ctx, x, y, s, s, s * 0.26, g);
  app.draw(ctx, x + s / 2, y + s / 2, s);
  if (label) text(ctx, label, x + s / 2, y + s + 22, `700 19px ${SANS}`, "#FFFFFF", "center", true);
  if (badge > 0) {
    const t = badge > 99 ? "99+" : String(badge);
    const w = Math.max(40, 18 + t.length * 15);
    rr(ctx, x + s - w / 2 - 4, y - 14, w, 40, 20, "#FF2D2D");
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x + s - w / 2 - 4, y - 14, w, 40, 20);
    ctx.stroke();
    text(ctx, t, x + s - 4, y + 7, `800 24px ${SANS}`, "#FFFFFF", "center");
  }
};

/** Warm Andean wallpaper: sunrise gradient, sun and a Huayna Picchu silhouette. */
const wallpaper = (ctx: Ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, "#FFB547");
  g.addColorStop(0.42, "#FF6B6B");
  g.addColorStop(1, "#6C3FE0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  circle(ctx, 360, 640, 90, "rgba(255,230,140,0.85)");
  ctx.fillStyle = "#4B2A9E";
  ctx.beginPath();
  ctx.moveTo(0, 780);
  ctx.lineTo(110, 700);
  ctx.lineTo(190, 745);
  ctx.quadraticCurveTo(300, 520, 360, 560);
  ctx.quadraticCurveTo(400, 590, 420, 700);
  ctx.lineTo(512, 760);
  ctx.lineTo(512, SH);
  ctx.lineTo(0, SH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3A1F80";
  ctx.beginPath();
  ctx.moveTo(0, 860);
  ctx.quadraticCurveTo(180, 790, 330, 840);
  ctx.quadraticCurveTo(430, 870, 512, 830);
  ctx.lineTo(512, SH);
  ctx.lineTo(0, SH);
  ctx.closePath();
  ctx.fill();
};

const drawHome = (ctx: Ctx, badge: number) => {
  wallpaper(ctx);
  statusBar(ctx, "#FFFFFF");
  text(ctx, "10:30", SW / 2, 150, `124px ${FUN}`, "#FFFFFF", "center", true);
  text(ctx, "LUNES 21 · INTI RAYMI", SW / 2, 228, `800 22px ${SANS}`, "#FFFFFF", "center", true);
  const s = 92;
  const gap = (SW - 4 * s) / 5;
  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    appIcon(ctx, APPS[i], gap + col * (s + gap), 300 + row * 152, s, APPS[i].name, i === 0 ? badge : 0);
  }
  for (let i = 0; i < 3; i++) circle(ctx, SW / 2 - 18 + i * 18, 890, 5, i === 0 ? "#FFFFFF" : "rgba(255,255,255,0.45)");
  rr(ctx, 22, 920, SW - 44, 124, 40, "rgba(255,255,255,0.28)");
  const dock = [10, 0, 4, 7];
  for (let i = 0; i < 4; i++) appIcon(ctx, APPS[dock[i]], gap + i * (s + gap), 936, s, null, 0);
};

/** Wraps text into lines that fit `maxW`. */
const wrapText = (ctx: Ctx, s: string, maxW: number) => {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
};

const miniMap = (ctx: Ctx, x: number, y: number, w: number, h: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  ctx.fillStyle = "#9BE08F";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#FFF7E0";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + h * 0.75);
  ctx.bezierCurveTo(x + w * 0.3, y + h * 0.4, x + w * 0.6, y + h * 0.9, x + w + 10, y + h * 0.3);
  ctx.stroke();
  ctx.strokeStyle = "#5AB8F0";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y - 10);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.05, y + h + 10);
  ctx.stroke();
  ctx.restore();
  pinGlyph(ctx, x + w * 0.58, y + h * 0.42, 90, "#FF3B30");
};

const drawChat = (ctx: Ctx, messages: ChatMessage[]) => {
  ctx.fillStyle = "#F7ECDD";
  ctx.fillRect(0, 0, SW, SH);
  // Faint stepped pattern on the chat background.
  ctx.fillStyle = "rgba(200,120,60,0.07)";
  for (let y = 180; y < SH; y += 64) {
    for (let x = (y / 64) % 2 ? 0 : 32; x < SW; x += 64) {
      ctx.fillRect(x + 20, y + 20, 24, 8);
      ctx.fillRect(x + 28, y + 12, 8, 24);
    }
  }
  const hg = ctx.createLinearGradient(0, 0, SW, 170);
  hg.addColorStop(0, "#FF8A3D");
  hg.addColorStop(1, "#E8342A");
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, SW, 172);
  statusBar(ctx, "#FFFFFF");
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(42, 100);
  ctx.lineTo(28, 118);
  ctx.lineTo(42, 136);
  ctx.stroke();
  circle(ctx, 96, 118, 34, "#FFD23F");
  sunGlyph(ctx, 96, 118, 13, "#E07B00");
  text(ctx, "Chasqui del Norte", 144, 104, `800 27px ${SANS}`, "#FFFFFF");
  text(ctx, "en línea", 144, 136, `700 20px ${SANS}`, "rgba(255,255,255,0.85)");
  llamaGlyph(ctx, 470, 120, 52, "#FFFFFF");
  // Bubbles, stacked from the top.
  let y = 205;
  ctx.font = `700 25px ${SANS}`;
  for (const m of messages) {
    const me = m.from === "me";
    if (m.location) {
      const w = 300;
      const h = 210;
      const x = me ? SW - 24 - w : 24;
      rr(ctx, x, y, w, h + 50, 26, me ? "#FF8A3D" : "#FFFFFF");
      miniMap(ctx, x + 10, y + 10, w - 20, h - 20);
      text(ctx, "Mi ubicación", x + 22, y + h + 20, `800 22px ${SANS}`, me ? "#FFFFFF" : "#E8342A");
      y += h + 70;
      continue;
    }
    ctx.font = `700 25px ${SANS}`;
    const lines = wrapText(ctx, m.text ?? "", 300);
    const w = Math.min(360, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
    const h = lines.length * 34 + 30;
    const x = me ? SW - 24 - w : 24;
    rr(ctx, x + 2, y + 4, w, h, 26, "rgba(90,50,20,0.12)");
    rr(ctx, x, y, w, h, 26, me ? "#FF7A2F" : "#FFFFFF");
    lines.forEach((l, i) => text(ctx, l, x + 22, y + 32 + i * 34, `700 25px ${SANS}`, me ? "#FFFFFF" : "#2A1E16"));
    y += h + 20;
  }
  // Input bar.
  rr(ctx, 20, SH - 104, SW - 124, 76, 38, "#FFFFFF");
  text(ctx, "Mensaje", 50, SH - 66, `700 24px ${SANS}`, "#B5A898");
  circle(ctx, SW - 62, SH - 66, 38, "#FF7A2F");
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(SW - 76, SH - 86);
  ctx.lineTo(SW - 42, SH - 66);
  ctx.lineTo(SW - 76, SH - 46);
  ctx.closePath();
  ctx.fill();
};

const NOTIFS = [
  "¡Mi Inca, hay un problema en el norte!",
  "¿Leyó mi mensaje, mi Inca?",
  "¡URGENTE! Responda por favor",
  "Mi Inca, noticias urgentes",
  "Hola?? Mi Inca???",
];

const drawNotifs = (ctx: Ctx, badge: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, "#241B4A");
  g.addColorStop(1, "#57207A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  statusBar(ctx, "#FFFFFF");
  text(ctx, "10:31", SW / 2, 118, `90px ${FUN}`, "#FFFFFF", "center");
  // The big red badge.
  const t = badge > 99 ? "99+" : String(badge);
  circle(ctx, SW / 2, 300, 128, "#FFFFFF");
  circle(ctx, SW / 2, 300, 114, "#FF2D2D");
  const rg = ctx.createRadialGradient(SW / 2 - 30, 260, 10, SW / 2, 300, 114);
  rg.addColorStop(0, "rgba(255,255,255,0.35)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  circle(ctx, SW / 2, 300, 114, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(SW / 2, 300, 114, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, t, SW / 2, 306, `${t.length > 2 ? 104 : 124}px ${FUN}`, "#FFFFFF", "center", true);
  text(ctx, "MENSAJES NUEVOS", SW / 2, 458, `900 26px ${SANS}`, "#FFD6D6", "center");
  // Stack of notification cards.
  for (let i = 0; i < 5; i++) {
    const inset = i * 12;
    const y = 500 + i * 104;
    const w = SW - 44 - inset * 2;
    const x = 22 + inset;
    rr(ctx, x + 2, y + 5, w, 92, 22, "rgba(0,0,0,0.25)");
    rr(ctx, x, y, w, 92, 22, i === 0 ? "#FFFFFF" : `rgba(255,255,255,${0.92 - i * 0.12})`);
    rr(ctx, x + 14, y + 16, 60, 60, 16, "#FF6A2B");
    llamaGlyph(ctx, x + 44, y + 50, 46, "#FFFFFF");
    text(ctx, "Chaski · Chasqui", x + 88, y + 30, `800 20px ${SANS}`, "#E8342A");
    text(ctx, "ahora", x + w - 16, y + 30, `700 17px ${SANS}`, "#8A7F92", "right");
    ctx.font = `700 21px ${SANS}`;
    const line = wrapText(ctx, NOTIFS[i], w - 110)[0];
    text(ctx, line, x + 88, y + 62, `700 21px ${SANS}`, "#2A1E30");
  }
};

const drawCamera = (ctx: Ctx) => {
  // The live view: Machu Picchu under a blue sky.
  const sky = ctx.createLinearGradient(0, 0, 0, 700);
  sky.addColorStop(0, "#2F7BEA");
  sky.addColorStop(1, "#BFE8FF");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SW, SH);
  ctx.fillStyle = "#FFFFFF";
  for (const [x, y, r] of [
    [90, 230, 34],
    [130, 215, 44],
    [175, 232, 32],
    [380, 170, 26],
    [410, 160, 34],
  ]) circle(ctx, x, y, r, "#FFFFFF");
  ctx.fillStyle = "#2E7D3A";
  ctx.beginPath();
  ctx.moveTo(150, 700);
  ctx.quadraticCurveTo(250, 300, 330, 330);
  ctx.quadraticCurveTo(390, 360, 430, 700);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3E9A43";
  ctx.beginPath();
  ctx.moveTo(0, 620);
  ctx.quadraticCurveTo(120, 560, 210, 640);
  ctx.lineTo(210, SH);
  ctx.lineTo(0, SH);
  ctx.fill();
  ctx.fillStyle = "#5DB84A";
  ctx.fillRect(0, 700, SW, SH - 700);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? "#6CC957" : "#52AE44";
    ctx.fillRect(0, 700 + i * 44, SW, 30);
    ctx.fillStyle = "#A9A294";
    ctx.fillRect(0, 730 + i * 44, SW, 14);
  }
  for (let i = 0; i < 6; i++) {
    rr(ctx, 60 + i * 70, 668 - (i % 2) * 12, 52, 36, 4, "#C9C2B4");
    ctx.fillStyle = "#C99B45";
    ctx.beginPath();
    ctx.moveTo(56 + i * 70, 668 - (i % 2) * 12);
    ctx.lineTo(86 + i * 70, 640 - (i % 2) * 12);
    ctx.lineTo(116 + i * 70, 668 - (i % 2) * 12);
    ctx.fill();
  }
  // Camera UI.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (const k of [1, 2]) {
    ctx.beginPath();
    ctx.moveTo((SW * k) / 3, 90);
    ctx.lineTo((SW * k) / 3, SH - 230);
    ctx.moveTo(0, 90 + ((SH - 320) * k) / 3);
    ctx.lineTo(SW, 90 + ((SH - 320) * k) / 3);
    ctx.stroke();
  }
  ctx.strokeStyle = "#FFD23F";
  ctx.lineWidth = 6;
  const fx = SW / 2;
  const fy = 470;
  const b = 70;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(fx + sx * b, fy + sy * (b - 26));
    ctx.lineTo(fx + sx * b, fy + sy * b);
    ctx.lineTo(fx + sx * (b - 26), fy + sy * b);
    ctx.stroke();
  }
  rr(ctx, 0, 0, SW, 84, 0, "rgba(0,0,0,0.35)");
  statusBar(ctx, "#FFFFFF");
  rr(ctx, SW / 2 - 92, 90, 184, 48, 24, "rgba(0,0,0,0.45)");
  circle(ctx, SW / 2 - 60, 114, 11, "#FF2D2D");
  text(ctx, "REC 0:15", SW / 2 + 10, 115, `800 24px ${SANS}`, "#FFFFFF", "center");
  rr(ctx, 0, SH - 240, SW, 240, 0, "rgba(0,0,0,0.5)");
  text(ctx, "FOTO", 120, SH - 204, `800 22px ${SANS}`, "rgba(255,255,255,0.7)", "center");
  text(ctx, "VIDEO", SW / 2, SH - 204, `900 24px ${SANS}`, "#FFD23F", "center");
  text(ctx, "SELFI", 392, SH - 204, `800 22px ${SANS}`, "rgba(255,255,255,0.7)", "center");
  circle(ctx, SW / 2, SH - 100, 64, "#FFFFFF");
  circle(ctx, SW / 2, SH - 100, 54, "rgba(0,0,0,0.5)");
  circle(ctx, SW / 2, SH - 100, 46, "#FF2D2D");
  rr(ctx, 70, SH - 134, 70, 70, 16, "#6CC957");
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(70, SH - 134, 70, 70, 16);
  ctx.stroke();
  circle(ctx, 406, SH - 100, 36, "rgba(255,255,255,0.25)");
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(406, SH - 100, 18, 0.3, Math.PI * 1.6);
  ctx.stroke();
};

const drawWeather = (ctx: Ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, "#5B7BC0");
  g.addColorStop(1, "#2A3A66");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  statusBar(ctx, "#FFFFFF");
  rr(ctx, 26, 74, 64, 64, 18, "#FFD98A");
  potatoGlyph(ctx, 58, 108, 58);
  text(ctx, "PapaBot Clima", 106, 94, `800 24px ${SANS}`, "#FFFFFF");
  text(ctx, "Cusco · Valle Sagrado", 106, 124, `700 19px ${SANS}`, "rgba(255,255,255,0.8)");
  text(ctx, "MAÑANA", SW / 2, 200, `900 34px ${SANS}`, "#DDE8FF", "center");
  // Rain drops, then the big cloud.
  ctx.fillStyle = "#6FD0FF";
  for (let i = 0; i < 9; i++) {
    const x = 150 + (i % 5) * 52 + (i >= 5 ? 26 : 0);
    const y = 400 + (i >= 5 ? 70 : 0) + (i % 2) * 20;
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.quadraticCurveTo(x + 16, y, x, y + 14);
    ctx.quadraticCurveTo(x - 16, y, x, y - 26);
    ctx.fill();
  }
  cloudGlyph(ctx, SW / 2, 310, 300, "#FFFFFF");
  text(ctx, "14°", SW / 2, 610, `150px ${FUN}`, "#FFFFFF", "center", true);
  text(ctx, "LLUVIA", SW / 2, 720, `70px ${FUN}`, "#8FE0FF", "center", true);
  rr(ctx, 40, 780, SW - 80, 62, 31, "rgba(255,255,255,0.18)");
  text(ctx, "¡Ideal para sembrar papa!", SW / 2, 812, `800 23px ${SANS}`, "#FFFFFF", "center");
  const days: [string, string, string][] = [
    ["HOY", "sun", "18°"],
    ["MAÑ", "rain", "14°"],
    ["MIÉ", "cloud", "16°"],
    ["JUE", "sun", "19°"],
  ];
  days.forEach(([d, k, t], i) => {
    const x = 34 + i * 114;
    rr(ctx, x, 870, 100, 150, 22, i === 1 ? "rgba(143,224,255,0.35)" : "rgba(255,255,255,0.14)");
    text(ctx, d, x + 50, 896, `800 20px ${SANS}`, "#FFFFFF", "center");
    if (k === "sun") sunGlyph(ctx, x + 50, 944, 13, "#FFD23F");
    else cloudGlyph(ctx, x + 50, 944, 58, "#FFFFFF");
    if (k === "rain") {
      ctx.fillStyle = "#6FD0FF";
      for (let j = 0; j < 3; j++) ctx.fillRect(x + 32 + j * 14, 968, 5, 12);
    }
    text(ctx, t, x + 50, 998, `800 24px ${SANS}`, "#FFFFFF", "center");
  });
};

const drawOff = (ctx: Ctx) => {
  const g = ctx.createLinearGradient(0, 0, SW, SH);
  g.addColorStop(0, "#07090D");
  g.addColorStop(0.5, "#141926");
  g.addColorStop(1, "#07090D");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
};

const screenTexture = (screen: PhoneScreen, badge: number, messages: ChatMessage[], res: number) => {
  const key = `inca-phone|${screen}|${screen === "home" || screen === "notifs" ? badge : 0}|${screen === "chat" ? JSON.stringify(messages) : ""}|${res}`;
  return canvasTexture(key, SW * res, SH * res, (ctx) => {
    ctx.scale(res, res);
    if (screen === "home") drawHome(ctx, badge);
    else if (screen === "chat") drawChat(ctx, messages);
    else if (screen === "notifs") drawNotifs(ctx, badge);
    else if (screen === "camera") drawCamera(ctx);
    else if (screen === "weather") drawWeather(ctx);
    else drawOff(ctx);
  });
};

const GLOW_TINT: Record<PhoneScreen, string> = {
  home: "#FFB27A",
  chat: "#FF9A5A",
  notifs: "#FF5A5A",
  camera: "#CFEFFF",
  weather: "#8FD8FF",
  off: "#FFFFFF",
};

const sheenTexture = () =>
  canvasTexture("inca-phone-sheen", 128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(255,255,255,0.16)");
    g.addColorStop(0.35, "rgba(255,255,255,0.04)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

type PhoneProps = {
  screen?: PhoneScreen;
  /** Unread count: the chat-app badge on "home", the big badge on "notifs" (> 99 shows 99+). */
  badge?: number;
  /** 0..1+: soft halo around the phone (the screen itself is always lit). */
  glow?: number;
  /** Chat bubbles for the "chat" screen (defaults to the chasqui / Sapa Inca exchange). */
  messages?: ChatMessage[];
};

const PhoneBody: React.FC<PhoneProps & { res: number }> = ({ screen = "home", badge, glow = 0, messages = DEFAULT_CHAT, res }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => {
    const body = new THREE.ExtrudeGeometry(roundedRectShape(0.48, 0.98, 0.066), {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 10,
    });
    body.translate(0, 0, -0.015);
    const screenGeo = planarUV(new THREE.ShapeGeometry(roundedRectShape(0.455, 0.955, 0.056), 12));
    return {
      body,
      screen: screenGeo,
      lens: new THREE.CylinderGeometry(0.03, 0.03, 0.014, 24),
      lensRing: new THREE.TorusGeometry(0.034, 0.006, 8, 24),
      flash: new THREE.SphereGeometry(0.012, 10, 8),
      logo: new THREE.CylinderGeometry(0.045, 0.045, 0.004, 28),
      halo: new THREE.PlaneGeometry(1, 1),
    };
  }, []);
  const bump = useRounded(0.19, 0.2, 0.016, 0.007, 3);
  const btnA = useRounded(0.012, 0.09, 0.02, 0.005, 2);
  const btnB = useRounded(0.012, 0.16, 0.02, 0.005, 2);
  const n = badge ?? (screen === "notifs" ? 100 : 3);
  const tex = ready ? screenTexture(screen, n, messages, res) : null;
  const screenMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tex ? "#ffffff" : "#07090D", map: tex, toneMapped: false }),
    [tex],
  );
  const sheenMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: sheenTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: GLOW_TINT[screen],
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [screen],
  );
  haloMat.opacity = Math.min(1, glow) * 0.85;
  const shell = toy("#232733", { metal: 0.35, rough: 0.38, glow: 0.05 });
  const dark = toy("#14161D", { metal: 0.3, rough: 0.3, glow: 0.02 });
  const glass = toy("#0A0C12", { metal: 0.5, rough: 0.12, glow: 0 });
  return (
    <group>
      {glow > 0.001 && screen !== "off" ? (
        <mesh geometry={geos.halo} material={haloMat} position={[0, 0, -0.04]} scale={[1.5 + glow * 0.4, 1.9 + glow * 0.4, 1]} renderOrder={2} />
      ) : null}
      <mesh geometry={geos.body} material={shell} castShadow />
      <mesh geometry={geos.screen} material={screenMat} position={[0, 0, 0.0262]} />
      <mesh geometry={geos.screen} material={sheenMat} position={[0, 0, 0.0266]} renderOrder={3} />
      {/* Camera bump on the back (top-left seen from behind). */}
      <group position={[0.12, 0.34, -0.025]}>
        <mesh geometry={bump} material={dark} position={[0, 0, -0.006]} />
        {[0.047, -0.047].map((y) => (
          <group key={y} position={[-0.045, y, -0.017]}>
            <mesh geometry={geos.lens} material={glass} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={geos.lensRing} material={toy("#5A6070", { metal: 0.7, rough: 0.3, glow: 0.05 })} />
          </group>
        ))}
        <mesh geometry={geos.flash} material={toy("#FFF2C2", { glow: 0.5 })} position={[0.045, 0.047, -0.014]} scale={[1, 1, 0.5]} />
      </group>
      {/* A little gold sun on the back instead of a brand logo. */}
      <mesh geometry={geos.logo} material={toy("#FFC21A", { metal: 0.6, rough: 0.3, glow: 0.25 })} position={[0, 0.02, -0.0262]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={btnA} material={shell} position={[0.251, 0.16, 0]} />
      <mesh geometry={btnB} material={shell} position={[-0.251, 0.2, 0]} />
    </group>
  );
};

/**
 * Smartphone, 1 tall x 0.5 wide x 0.05 deep at scale 1, origin at its centre, screen to +z.
 * In Nubi's fin use model-unit scale ≈ 3: see PHONE_HOLD_R / PHONE_HOLD_L.
 */
export const Phone3D: React.FC<PhoneProps> = (props) => <PhoneBody {...props} res={1} />;

/**
 * The giant phone that falls from the sky: the same phone with a double-resolution screen,
 * `height` tall (default 8, in the parent's units), origin at the BOTTOM centre so it can land
 * on something, and a volume-preserving `squash` (pivot at the bottom) for the impact.
 * Caught by Nubi: <Nubi holdR={<group position={[0.9, -0.4, 0.9]}><GiantPhone height={8} /></group>}>
 * (model units; the bottom rests on the fin tip).
 */
export const GiantPhone: React.FC<PhoneProps & { height?: number; squash?: number }> = ({ height = 8, squash = 1, ...props }) => {
  const sq = Math.max(0.3, squash);
  const sx = 1 / Math.sqrt(sq);
  return (
    <group scale={[height * sx, height * sq, height * sx]}>
      <group position={[0, 0.5, 0]}>
        <PhoneBody {...props} res={2} />
      </group>
    </group>
  );
};

/** Phone in <Nubi holdR>: screen to the camera, bottom edge resting in the fin tip. */
export const PHONE_HOLD_R = { position: [0.25, 1.3, 0.75] as V3, rotation: [0.08, -0.22, 0.06] as V3, scale: 3 };
/** Mirror of PHONE_HOLD_R for <Nubi holdL>. */
export const PHONE_HOLD_L = { position: [-0.25, 1.3, 0.75] as V3, rotation: [0.08, 0.22, -0.06] as V3, scale: 3 };
