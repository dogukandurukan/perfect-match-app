// Generated, clearly synthetic adult portraits for the DEV profile pool.
// Flat illustrated style (no real person, no photo source, no third-party
// licence): every image carries a "DEV · SYNTHETIC" tag. Rendered SVG → PNG
// with macOS's built-in Quick Look (qlmanage) — no new dependency.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HAIR = {
  long: (c) => `<path d="M290 430 Q290 200 500 190 Q710 200 710 430 L730 760 Q500 820 270 760 Z" fill="${c}"/>`,
  bob: (c) => `<path d="M300 440 Q300 210 500 200 Q700 210 700 440 L705 600 Q500 640 295 600 Z" fill="${c}"/>`,
  bun: (c) => `<circle cx="500" cy="200" r="80" fill="${c}"/><path d="M315 430 Q320 235 500 228 Q680 235 685 430 Q600 330 500 330 Q400 330 315 430Z" fill="${c}"/>`,
  curly: (c) => Array.from({ length: 14 }, (_, i) => {
    const a = (Math.PI * (i + 0.5)) / 13;
    return `<circle cx="${500 - Math.cos(a) * 205}" cy="${430 - Math.sin(a) * 215}" r="78" fill="${c}"/>`;
  }).join('') + `<circle cx="300" cy="560" r="70" fill="${c}"/><circle cx="700" cy="560" r="70" fill="${c}"/>`,
  pixie: (c) => `<path d="M318 420 Q318 220 500 215 Q690 220 684 420 Q640 300 520 310 Q420 300 318 420Z" fill="${c}"/>`,
  wavy: (c) => `<path d="M285 440 Q300 200 500 195 Q700 200 715 440 Q740 560 700 700 Q660 640 690 560 Q640 640 600 700 L400 700 Q360 640 310 560 Q340 640 300 700 Q260 560 285 440Z" fill="${c}"/>`,
};

const ACCESSORY = {
  none: () => '',
  glasses: () =>
    `<g fill="none" stroke="#2B211C" stroke-width="9"><circle cx="440" cy="470" r="44"/><circle cx="560" cy="470" r="44"/><path d="M484 470 h32"/></g>`,
  earrings: () => `<circle cx="352" cy="560" r="12" fill="#C9A227"/><circle cx="648" cy="560" r="12" fill="#C9A227"/>`,
};

const SCENES = {
  sea: `<rect width="1000" height="1000" fill="#CFE1E6"/><rect y="620" width="1000" height="380" fill="#8FB3BF"/><circle cx="820" cy="190" r="70" fill="#F3E2B8"/>`,
  park: `<rect width="1000" height="1000" fill="#E6ECE3"/><circle cx="160" cy="300" r="140" fill="#A9C2A0"/><circle cx="860" cy="260" r="160" fill="#9DB894"/><rect y="760" width="1000" height="240" fill="#B7CBA9"/>`,
  city: `<rect width="1000" height="1000" fill="#EDE6D6"/>${[80, 230, 640, 800].map((x, i) => `<rect x="${x}" y="${300 + (i % 2) * 80}" width="120" height="700" fill="#D8CDB7"/>`).join('')}`,
  cafe: `<rect width="1000" height="1000" fill="#F1E4D3"/><rect y="700" width="1000" height="300" fill="#C9A98A"/><circle cx="170" cy="200" r="60" fill="#E7D3B5"/>`,
};

function portraitSvg(p, variant) {
  const scene = variant === 0 ? `<rect width="1000" height="1000" fill="${p.bg}"/>` : SCENES[p.scene];
  const s = variant === 0 ? 1 : 0.78;
  const ty = variant === 0 ? 0 : 180;
  const tx = variant === 0 ? 0 : 110;
  const person = `
    <g transform="translate(${tx} ${ty}) scale(${s})">
      ${p.hairStyle === 'long' || p.hairStyle === 'wavy' ? HAIR[p.hairStyle](p.hair) : ''}
      <path d="M170 1000 Q190 780 500 760 Q810 780 830 1000Z" fill="${p.top}"/>
      <path d="M440 740 Q500 800 560 740" fill="${p.skinShade}"/>
      <rect x="445" y="620" width="110" height="150" rx="40" fill="${p.skinShade}"/>
      ${p.hairStyle !== 'long' && p.hairStyle !== 'wavy' ? HAIR[p.hairStyle](p.hair) : ''}
      <ellipse cx="500" cy="470" rx="160" ry="195" fill="${p.skin}"/>
      <ellipse cx="342" cy="490" rx="22" ry="34" fill="${p.skin}"/><ellipse cx="658" cy="490" rx="22" ry="34" fill="${p.skin}"/>
      ${p.hairStyle === 'long' || p.hairStyle === 'wavy' ? `<path d="M340 400 Q380 290 500 285 Q640 290 662 400 Q600 340 500 345 Q400 340 340 400Z" fill="${p.hair}"/>` : ''}
      <path d="M405 425 Q440 405 475 422" stroke="${p.brow}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M525 422 Q560 405 595 425" stroke="${p.brow}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <ellipse cx="440" cy="470" rx="13" ry="15" fill="#2B211C"/><ellipse cx="560" cy="470" rx="13" ry="15" fill="#2B211C"/>
      <path d="M500 490 Q490 540 505 548" stroke="${p.skinShade}" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M455 585 Q500 ${variant === 1 ? 625 : 612} 545 585" stroke="#9C4F45" stroke-width="10" fill="none" stroke-linecap="round"/>
      <circle cx="405" cy="545" r="22" fill="#E59A8C" opacity="0.35"/><circle cx="595" cy="545" r="22" fill="#E59A8C" opacity="0.35"/>
      ${ACCESSORY[p.accessory]()}
    </g>`;
  const extra = variant === 2 ? itemSvg(p.item) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
    ${variant === 2 ? `<rect width="1000" height="1000" fill="${p.bg}"/>` : scene}
    ${variant === 2 ? '' : person}
    ${extra}
    <rect x="28" y="28" rx="16" width="330" height="62" fill="#1C1B18" opacity="0.78"/>
    <text x="52" y="70" font-family="Helvetica" font-size="30" font-weight="700" fill="#FFFFFF">DEV · SYNTHETIC</text>
  </svg>`;
}

// Third photo: an interest still life (no person).
function itemSvg(item) {
  const items = {
    coffee: `<ellipse cx="500" cy="760" rx="260" ry="50" fill="#D8CDB7"/><path d="M340 470 h300 l-30 280 q-120 40 -240 0z" fill="#FFFDF8" stroke="#1F3A2E" stroke-width="12"/><path d="M640 520 q90 0 80 80 q-10 70 -100 60" fill="none" stroke="#1F3A2E" stroke-width="16"/><path d="M430 400 q-30 -60 0 -110 M500 400 q-30 -60 0 -110 M570 400 q-30 -60 0 -110" stroke="#9AA59C" stroke-width="12" fill="none" stroke-linecap="round"/>`,
    books: [0, 1, 2, 3].map((i) => `<rect x="${280 - i * 10}" y="${740 - i * 95}" width="${440 + i * 20}" height="85" rx="10" fill="${['#1F3A2E', '#C9A227', '#8C4B3C', '#5E7D6A'][i]}"/>`).join(''),
    bike: `<g fill="none" stroke="#1F3A2E" stroke-width="16"><circle cx="320" cy="680" r="140"/><circle cx="680" cy="680" r="140"/><path d="M320 680 L450 470 L620 470 L680 680 M450 470 L520 680 L620 470 M430 430 h60 M600 430 l40 -50 h50"/></g>`,
    plant: `<path d="M380 760 h240 l-30 170 h-180z" fill="#8C4B3C"/><path d="M500 760 q-10 -200 0 -380" stroke="#1F3A2E" stroke-width="14" fill="none"/>${[[-1, 520], [1, 600], [-1, 660], [1, 470]].map(([d, y]) => `<ellipse cx="${500 + d * 110}" cy="${y}" rx="110" ry="45" transform="rotate(${d * -25} ${500 + d * 110} ${y})" fill="#7FA77A"/>`).join('')}`,
    camera: `<rect x="270" y="440" width="460" height="300" rx="40" fill="#1F3A2E"/><rect x="420" y="390" width="160" height="70" rx="16" fill="#1F3A2E"/><circle cx="500" cy="590" r="110" fill="#E6ECE3"/><circle cx="500" cy="590" r="70" fill="#5E7D6A"/>`,
    music: `<path d="M420 760 V420 L680 360 V700" stroke="#1F3A2E" stroke-width="22" fill="none"/><ellipse cx="380" cy="760" rx="70" ry="52" fill="#1F3A2E"/><ellipse cx="640" cy="700" rx="70" ry="52" fill="#1F3A2E"/>`,
  };
  return items[item] ?? items.coffee;
}

/** Renders the 3 photos + a selfie stand-in for one person; returns PNG buffers. */
export function renderPortraits(p) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tempa-portrait-'));
  try {
    const out = [];
    for (const v of [0, 1, 2]) {
      const f = path.join(dir, `p${v}.svg`);
      fs.writeFileSync(f, portraitSvg(p, v));
      execFileSync('qlmanage', ['-t', '-s', '1000', '-o', dir, f], { stdio: 'ignore' });
      out.push(fs.readFileSync(`${f}.png`));
    }
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
