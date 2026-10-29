/* 程序化召唤兽立绘：纯 SVG，无外部图片。按名称关键字选择形体模板，按五行与个体种子变化配色。 */
(function () {
  'use strict';

  const INK = '#2b1d13';
  const GOLD = '#d8b25c';
  const GOLD_DARK = '#9a742f';
  const RED = '#b23a2e';
  const CREAM = '#f8eed8';

  const ELEMENT_BASE = {
    金: { main: '#e8c97c', deep: '#b1853c', light: '#faeec4', accent: '#7c541d', glow: '#f3d894' },
    木: { main: '#a9c98a', deep: '#5f8f5a', light: '#e2efc9', accent: '#33553a', glow: '#c8e0a0' },
    水: { main: '#9fd0d8', deep: '#4f8fa3', light: '#e0f2f3', accent: '#234c5c', glow: '#b9e6ec' },
    火: { main: '#f0a184', deep: '#c05a3f', light: '#fbe0cb', accent: '#6d2418', glow: '#ffc09b' },
    土: { main: '#d9c39a', deep: '#9a7a4e', light: '#f3e7cc', accent: '#57402a', glow: '#ecd6a8' },
  };
  const VARIANT_BASE = { main: '#bda9da', deep: '#6c518f', light: '#eee3f8', accent: '#3b2a55', glow: '#d9c4f2' };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  }
  function shift(hex, seed, dh, ds, dl) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + dh, s + ds, l + dl);
  }

  function palette(element, seed, variant) {
    const rand = rng(seed);
    const base = variant ? VARIANT_BASE : (ELEMENT_BASE[element] || ELEMENT_BASE.土);
    const dh = (rand() * 26 - 13);
    const dl = (rand() * 6 - 3);
    const p = {
      main: shift(base.main, seed, dh, 0, dl),
      deep: shift(base.deep, seed, dh, 0, dl - 2),
      light: shift(base.light, seed, dh, 0, Math.min(3, dl)),
      accent: shift(base.accent, seed, dh, 0, 0),
      glow: base.glow,
    };
    p.cream = CREAM;
    p.ink = INK;
    p.gold = GOLD;
    p.goldDark = GOLD_DARK;
    p.red = RED;
    p.variant = !!variant;
    p.seed = seed;
    return p;
  }

  function templateFor(beast) {
    const n = beast.n;
    if (/龙|蛟|虬|螭|蜃|鲲/.test(n)) return 'dragon';
    if (/蛇|蟒/.test(n)) return 'serpent';
    if (/龟|鳖|鳌|鼋/.test(n)) return 'turtle';
    if (/蛙|蟾|蛤蟆/.test(n)) return 'frog';
    if (/虫|蛛|蝎|蜂|蝶|蛾|蚁|萤|蜈蚣|蝉|螳|蟋/.test(n)) return 'insect';
    if (/鸟|凤|鸾|鹤|雀|鹰|孔雀|青鸾|金乌|翼|飞天|大鹏|鹏/.test(n)) return 'bird';
    if (/鱼|鲛|鲨|海豚|鲸|海星|章鱼|虾|蟹|蚌/.test(n)) return 'fish';
    if (/花|草|叶|树|藤|竹|莲|荷|蔓|蘑菇|菌/.test(n)) return 'plant';
    if (/鬼|魂|幽灵|夜叉|修罗|无常|僵尸|骷髅|魅|幽|冥|阴|魑|魍|魉/.test(n)) return 'ghost';
    if (/女娲|仙子|天女|神女|灵仙|娃娃|童子|僧|罗汉|将军|护卫|武士|侍者|判官|大王|夫人|公主|太子|龙女|仙|道人|真人|天兵|天将|神将|元帅|司辰|司风|司雪|司雨/.test(n)) return 'humanoid';
    if (n === '涂山雪' || n === '涂山瞳' || /^涂山/.test(n)) return 'beast';
    if (/石|岩|机关|傀儡|守卫|金刚|力士|巨力|巨灵|山神|沙暴|城|车/.test(n)) return 'golem';
    if (/伞|灯|琴|镜|珠|卷|塔|钟|铃|笔|画|扇|炉|鼎|幡|符|剑|刀/.test(n)) return 'artifact';
    return 'beast';
  }

  function eyes(p, lx, rx, y, opts) {
    opts = opts || {};
    const r = opts.r || 7;
    const pupil = opts.pupil || 4.3;
    const look = opts.look || 0;
    const white = opts.white || '#fff9ea';
    return `<g>
      <ellipse cx="${lx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="${white}" stroke="${INK}" stroke-width="2.2"/>
      <ellipse cx="${rx}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="${white}" stroke="${INK}" stroke-width="2.2"/>
      <circle cx="${lx + look}" cy="${y + 1}" r="${pupil}" fill="${INK}"/>
      <circle cx="${rx + look}" cy="${y + 1}" r="${pupil}" fill="${INK}"/>
      <circle cx="${lx + look - 1.5}" cy="${y - 1.5}" r="${Math.max(1.1, r * 0.2)}" fill="#fff"/>
      <circle cx="${rx + look - 1.5}" cy="${y - 1.5}" r="${Math.max(1.1, r * 0.2)}" fill="#fff"/>
    </g>`;
  }

  function blush(x1, x2, y, color) {
    return `<ellipse cx="${x1}" cy="${y}" rx="6" ry="3.4" fill="${color || '#e2816c'}" opacity=".4"/>
            <ellipse cx="${x2}" cy="${y}" rx="6" ry="3.4" fill="${color || '#e2816c'}" opacity=".4"/>`;
  }

  function mouth(cx, y, w, curve) {
    return `<path d="M${cx - w} ${y} Q${cx} ${y + (curve || 4)} ${cx + w} ${y}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }

  function ground(p, w) {
    return `<ellipse cx="100" cy="179" rx="${w || 46}" ry="8" fill="#120c08" opacity=".26"/>`;
  }

  function sparkles(p, count, area) {
    const rand = rng(p.seed + 77);
    let out = '';
    for (let i = 0; i < count; i++) {
      const x = 26 + rand() * 150, y = 18 + rand() * 150, s = 1.4 + rand() * 2.4;
      out += `<path d="M${x} ${y - s} L${x + s * .45} ${y} L${x} ${y + s} L${x - s * .45} ${y} Z" fill="${p.gold}" opacity="${0.35 + rand() * 0.35}"/>`;
    }
    return out;
  }

  /* ---------------- 兽形 ---------------- */
  function beast(p, seed, beast) {
    const rand = rng(seed + 11);
    const name = beast.n;
    const stocky = rand() < 0.45;
    const mane = /狮|虎|貔|貅|狼|熊/.test(name) || rand() < 0.1;
    const longSnout = /猪|狗|狼|狐|狸|貂|鼠|象|犀|牛|羊/.test(name) || rand() < 0.2;
    const tusks = /猪|象|犀/.test(name);
    const whiskers = /猫|狐|狸|鼠|虎|兔/.test(name) || rand() < 0.28;
    const horned = /牛|羊|犀/.test(name);
    const antler = /鹿/.test(name);
    const tailKind = rand() < 0.42 ? 'fluffy' : rand() < 0.7 ? 'tuft' : 'curl';

    let ear = 'point';
    if (/兔/.test(name)) ear = 'long';
    else if (horned) ear = 'none';
    else if (/熊|猫|虎|豹|狮|貔|貅/.test(name)) ear = 'round';
    else if (rand() < 0.12) ear = 'long';
    else if (rand() < 0.24) ear = 'round';

    const pattern = rand() < 0.34 ? 'stripe' : rand() < 0.62 ? 'spot' : 'none';
    const markKind = rand() < 0.32 ? 'flame' : rand() < 0.6 ? 'diamond' : 'crescent';

    let maneSvg = '';
    if (mane) {
      let spikes = '';
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        const x1 = 100 + Math.cos(a - 0.13) * 38, y1 = 82 + Math.sin(a - 0.13) * 34;
        const x2 = 100 + Math.cos(a) * 54, y2 = 82 + Math.sin(a) * 50;
        const x3 = 100 + Math.cos(a + 0.13) * 38, y3 = 82 + Math.sin(a + 0.13) * 34;
        spikes += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} Z" fill="${i % 2 ? p.deep : p.main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
      }
      maneSvg = spikes;
    }

    let ears = '';
    if (ear === 'point') {
      ears = `<path d="M70 66 L62 30 L94 54 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
              <path d="M130 66 L138 30 L106 54 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
              <path d="M72 58 L68 39 L88 54 Z" fill="${p.light}" opacity=".85"/>
              <path d="M128 58 L132 39 L112 54 Z" fill="${p.light}" opacity=".85"/>`;
    } else if (ear === 'round') {
      ears = `<circle cx="68" cy="54" r="17" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
              <circle cx="132" cy="54" r="17" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
              <circle cx="68" cy="54" r="8" fill="${p.light}" opacity=".9"/>
              <circle cx="132" cy="54" r="8" fill="${p.light}" opacity=".9"/>`;
    } else if (ear === 'long') {
      ears = `<ellipse cx="78" cy="35" rx="12" ry="27" fill="${p.main}" stroke="${INK}" stroke-width="4" transform="rotate(-9 78 35)"/>
              <ellipse cx="122" cy="35" rx="12" ry="27" fill="${p.main}" stroke="${INK}" stroke-width="4" transform="rotate(9 122 35)"/>
              <ellipse cx="78" cy="36" rx="5" ry="17" fill="${p.light}" opacity=".9" transform="rotate(-9 78 36)"/>
              <ellipse cx="122" cy="36" rx="5" ry="17" fill="${p.light}" opacity=".9" transform="rotate(9 122 36)"/>`;
    } else if (antler) {
      ears = `<path d="M76 58 C60 44 54 24 60 14 M68 26 L56 20 M72 38 L58 36" fill="none" stroke="${p.gold}" stroke-width="6" stroke-linecap="round"/>
              <path d="M124 58 C140 44 146 24 140 14 M132 26 L144 20 M128 38 L142 36" fill="none" stroke="${p.gold}" stroke-width="6" stroke-linecap="round"/>`;
    } else if (ear === 'none') {
      ears = `<path d="M74 58 C52 54 42 34 52 24 C64 30 74 42 80 54 Z" fill="${p.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
              <path d="M126 58 C148 54 158 34 148 24 C136 30 126 42 120 54 Z" fill="${p.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
              <path d="M82 58 C76 46 68 38 58 32" fill="none" stroke="${p.goldDark}" stroke-width="2.4"/>`;
    }

    let tail = '';
    if (tailKind === 'fluffy') {
      tail = `<path d="M138 148 C170 156 184 126 168 104" fill="none" stroke="${p.deep}" stroke-width="19" stroke-linecap="round"/>
              <path d="M138 148 C170 156 184 126 168 104" fill="none" stroke="${p.main}" stroke-width="13" stroke-linecap="round"/>
              <circle cx="168" cy="104" r="13" fill="${p.light}" stroke="${INK}" stroke-width="3.4"/>`;
    } else if (tailKind === 'tuft') {
      tail = `<path d="M140 150 C170 146 182 118 172 96" fill="none" stroke="${p.deep}" stroke-width="8" stroke-linecap="round"/>
              <path d="M172 96 l10 -8 l-2 14 Z" fill="${p.gold}" stroke="${INK}" stroke-width="2.4"/>`;
    } else {
      tail = `<path d="M138 152 C166 152 174 134 162 124 C154 118 146 126 152 134" fill="none" stroke="${p.deep}" stroke-width="9" stroke-linecap="round"/>
              <circle cx="160" cy="132" r="5" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>`;
    }

    let marks = '';
    if (pattern === 'stripe') {
      marks = `<path d="M72 80 l-10 -7 M70 90 l-11 -2 M128 80 l10 -7 M130 90 l11 -2" stroke="${p.deep}" stroke-width="3.6" stroke-linecap="round"/>
               <path d="M92 52 l-4 -10 M108 52 l4 -10" stroke="${p.deep}" stroke-width="3.6" stroke-linecap="round"/>`;
    } else if (pattern === 'spot') {
      marks = `<circle cx="64" cy="88" r="5" fill="${p.deep}" opacity=".5"/><circle cx="136" cy="88" r="4" fill="${p.deep}" opacity=".5"/>
               <circle cx="70" cy="102" r="3" fill="${p.deep}" opacity=".4"/>`;
    }

    const bodyRx = stocky ? 45 : 38;
    const bodyRy = stocky ? 32 : 36;
    const headR = stocky ? 36 : 35;
    const muzzleY = longSnout ? 101 : 98;
    const muzzleRx = longSnout ? 25 : 23;
    const muzzleRy = longSnout ? 17 : 15;

    let mark = '';
    if (markKind === 'flame') {
      mark = `<path d="M100 48 C94 56 92 62 100 68 C108 62 106 56 100 48 Z" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>`;
    } else if (markKind === 'crescent') {
      mark = `<path d="M96 50 a9 9 0 1 0 0 18 a7 7 0 1 1 0 -18 Z" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>`;
    } else {
      mark = `<path d="M100 50 l7 9 -7 9 -7 -9 Z" fill="${p.gold}" stroke="${INK}" stroke-width="2.2"/>`;
    }

    const collar = rand() < 0.58
      ? `<path d="M74 116 q26 13 52 0" fill="none" stroke="${p.red}" stroke-width="6"/>
         <circle cx="100" cy="124" r="4.8" fill="${p.gold}" stroke="${INK}" stroke-width="1.8"/>`
      : `<path d="M76 118 q24 12 48 0" fill="none" stroke="${p.gold}" stroke-width="2.4" stroke-dasharray="1 5" opacity=".85"/>`;

    return `${ground(p, bodyRx + 6)}
      ${tail}
      <ellipse cx="100" cy="136" rx="${bodyRx}" ry="${bodyRy}" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <path d="M70 158 q-4 12 4 14 q9 2 12 -10" fill="${p.deep}" stroke="${INK}" stroke-width="3.4"/>
      <path d="M130 158 q4 12 -4 14 q-9 2 -12 -10" fill="${p.deep}" stroke="${INK}" stroke-width="3.4"/>
      <ellipse cx="100" cy="144" rx="26" ry="21" fill="${p.light}" opacity=".95"/>
      ${maneSvg}
      ${ears}
      <circle cx="100" cy="82" r="${headR}" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <ellipse cx="100" cy="${muzzleY}" rx="${muzzleRx}" ry="${muzzleRy}" fill="${p.light}"/>
      ${mark}
      ${marks}
      ${eyes(p, 86, 114, 80, { r: 7.4, look: 0.5 })}
      ${blush(72, 128, 96)}
      <path d="M96 ${muzzleY - 8} l4 -2 4 2 -4 5 Z" fill="${INK}"/>
      ${mouth(100, muzzleY + 3, longSnout ? 8 : 7, 4)}
      ${tusks ? `<path d="M88 104 q-2 10 -7 13 M112 104 q2 10 7 13" fill="none" stroke="#f3e9d2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${whiskers ? `<path d="M76 102 l-16 1 M76 108 l-15 5 M124 102 l16 1 M124 108 l15 5" stroke="${INK}" stroke-width="1.6" opacity=".55"/>` : ''}
      ${collar}
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  /* ---------------- 鸟形 ---------------- */
  function bird(p, seed, beast) {
    const rand = rng(seed + 23);
    const phoenix = /凤|鸾|孔雀|青鸾|鹤/.test(beast.n);
    const tailN = phoenix ? 5 : 3;
    let tail = '';
    for (let i = 0; i < tailN; i++) {
      const off = (i - (tailN - 1) / 2) * 13;
      const len = phoenix ? 68 : 42;
      const col = i % 2 ? p.main : p.deep;
      tail += `<path d="M100 150 C${100 + off * 0.4} ${150 + len * 0.4} ${100 + off} ${150 + len * 0.7} ${100 + off * 1.25} ${150 + len}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="${100 + off * 1.25}" cy="${150 + len}" r="5" fill="${p.gold}" stroke="${INK}" stroke-width="1.6"/>`;
    }
    return `${ground(p, 44)}
      ${tail}
      <path d="M76 108 C46 114 28 138 32 162 C46 160 58 150 66 138 C62 152 66 164 76 170 C84 154 86 130 82 114 Z" fill="${p.deep}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M124 108 C154 114 172 138 168 162 C154 160 142 150 134 138 C138 152 134 164 124 170 C116 154 114 130 118 114 Z" fill="${p.deep}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M60 126 q-10 16 -6 30 M140 126 q10 16 6 30 M52 132 q-8 12 -6 24 M148 132 q8 12 6 24" fill="none" stroke="${p.light}" stroke-width="2.2" opacity=".55"/>
      <ellipse cx="100" cy="130" rx="32" ry="40" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <ellipse cx="100" cy="142" rx="20" ry="25" fill="${p.light}"/>
      <path d="M100 114 q-10 8 -2 14 M100 114 q10 8 2 14" fill="none" stroke="${p.deep}" stroke-width="2" opacity=".45"/>
      <circle cx="100" cy="80" r="31" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <path d="M100 50 q-14 -20 0 -28 q8 12 4 28 Z" fill="${p.gold}" stroke="${INK}" stroke-width="3"/>
      <path d="M118 54 q4 -18 18 -20 q-4 14 -8 26 Z" fill="${p.red}" stroke="${INK}" stroke-width="3"/>
      <path d="M82 54 q-4 -18 -18 -20 q4 14 8 26 Z" fill="${p.red}" stroke="${INK}" stroke-width="3"/>
      <path d="M72 96 l-12 -6 l4 12 l10 0 Z M128 96 l12 -6 l-4 12 l-10 0 Z" fill="${p.light}" opacity=".9"/>
      <path d="M100 92 l10 7 -10 8 -10 -8 Z" fill="${p.gold}" stroke="${INK}" stroke-width="2.4"/>
      <path d="M91 101 q9 8 18 0" fill="none" stroke="${p.goldDark}" stroke-width="1.8"/>
      ${eyes(p, 87, 113, 78, { r: 6.8, look: 0.5 })}
      ${blush(76, 124, 92)}
      <path d="M74 108 q10 4 18 2 M126 108 q-10 4 -18 2" fill="none" stroke="${p.red}" stroke-width="2.4" opacity=".5"/>
      <path d="M90 168 l-6 10 M90 168 l2 12 M90 168 l10 9 M110 168 l6 10 M110 168 l-2 12 M110 168 l-10 9" stroke="${p.gold}" stroke-width="3.4" stroke-linecap="round"/>
      ${p.variant ? sparkles(p, 6) : ''}`;
  }

  /* ---------------- 龙形 ---------------- */
  function dragon(p, seed) {
    const rand = rng(seed + 31);
    const body = 'M54 166 C30 128 62 106 96 128 C128 148 158 118 146 82';
    let mane = '';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (Math.PI * i) / 8;
      const x1 = 104 + Math.cos(a - 0.12) * 32, y1 = 74 + Math.sin(a - 0.12) * 30;
      const x2 = 104 + Math.cos(a) * 48, y2 = 74 + Math.sin(a) * 44;
      const x3 = 104 + Math.cos(a + 0.12) * 32, y3 = 74 + Math.sin(a + 0.12) * 30;
      mane += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} Z" fill="${p.gold}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    return `${ground(p, 44)}
      <path d="M46 176 C28 150 40 130 60 136 M154 176 C172 150 160 130 140 136" fill="none" stroke="${p.deep}" stroke-width="2.4" opacity=".4"/>
      <path d="${body}" fill="none" stroke="${p.deep}" stroke-width="30" stroke-linecap="round"/>
      <path d="${body}" fill="none" stroke="${p.main}" stroke-width="22" stroke-linecap="round"/>
      <path d="M54 166 C30 128 62 106 96 128 C128 148 158 118 146 82" fill="none" stroke="${p.light}" stroke-width="7" stroke-linecap="round" opacity=".75" stroke-dasharray="2 9"/>
      <path d="M64 150 q-12 2 -16 12 M80 136 q-14 0 -20 10 M124 134 q14 2 18 12 M138 118 q14 -2 20 -12" fill="none" stroke="${p.gold}" stroke-width="4" stroke-linecap="round"/>
      <path d="M66 158 q-4 10 -12 12 M74 158 q0 10 -4 14 M128 152 q4 10 12 12 M118 156 q2 10 6 12" fill="none" stroke="${p.goldDark}" stroke-width="3" stroke-linecap="round"/>
      <path d="M84 120 q4 6 0 12 M104 134 q4 6 0 12 M120 130 q4 6 0 12 M132 112 q4 6 0 12" fill="none" stroke="${p.gold}" stroke-width="2.4" opacity=".75"/>
      <path d="M74 46 C58 34 58 16 68 8 C76 20 82 32 88 44 Z" fill="${p.gold}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M134 46 C150 34 150 16 140 8 C132 20 126 32 120 44 Z" fill="${p.gold}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="M66 14 l-8 -6 M72 22 l-10 0 M134 14 l8 -6 M128 22 l10 0" stroke="${p.goldDark}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="154" cy="152" r="13" fill="${p.light}" stroke="${INK}" stroke-width="3.4"/>
      <circle cx="154" cy="152" r="6" fill="${p.gold}" opacity=".9"/>
      <circle cx="154" cy="152" r="19" fill="none" stroke="${p.glow}" stroke-width="1.4" opacity=".55"/>
      ${mane}
      <circle cx="104" cy="74" r="33" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <ellipse cx="104" cy="92" rx="24" ry="15" fill="${p.light}"/>
      <path d="M92 72 q4 -12 14 -12 M108 60 q10 2 12 12" fill="none" stroke="${p.deep}" stroke-width="2.6" opacity=".45"/>
      ${eyes(p, 91, 117, 70, { r: 7, look: 0.5 })}
      ${blush(76, 132, 86)}
      <path d="M96 86 l4 -2 4 2 -4 4 Z" fill="${INK}"/>
      <path d="M104 92 q-7 8 -14 4 M104 92 q7 8 14 4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M94 98 l-3 6 M114 98 l3 6" stroke="#f3e9d2" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M80 94 C64 96 54 104 50 116 M128 94 C144 96 154 104 158 116" fill="none" stroke="${p.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M100 50 l4 7 7 1 -7 3 -4 7 -4 -7 -7 -3 7 -1 Z" fill="${p.red}" stroke="${INK}" stroke-width="1.6"/>
      ${p.variant ? sparkles(p, 6) : ''}`;
  }

  /* ---------------- 龟形 ---------------- */
  function turtle(p, seed) {
    const rand = rng(seed + 41);
    return `${ground(p, 54)}
      <ellipse cx="100" cy="126" rx="54" ry="45" fill="${p.deep}" stroke="${INK}" stroke-width="4.5"/>
      <ellipse cx="100" cy="124" rx="44" ry="36" fill="${p.main}"/>
      <path d="M100 92 L124 108 L124 140 L100 156 L76 140 L76 108 Z" fill="none" stroke="${p.goldDark}" stroke-width="2.6" opacity=".75"/>
      <path d="M100 92 L100 156 M76 108 L124 140 M124 108 L76 140" stroke="${p.goldDark}" stroke-width="1.8" opacity=".5"/>
      <ellipse cx="60" cy="152" rx="14" ry="8" fill="${p.deep}" stroke="${INK}" stroke-width="3" transform="rotate(-18 60 152)"/>
      <ellipse cx="140" cy="152" rx="14" ry="8" fill="${p.deep}" stroke="${INK}" stroke-width="3" transform="rotate(18 140 152)"/>
      <path d="M64 100 q-14 8 -10 20 M136 100 q14 8 10 20" fill="none" stroke="${p.main}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="100" cy="74" r="28" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="100" cy="86" rx="18" ry="12" fill="${p.light}"/>
      ${eyes(p, 89, 111, 72, { r: 6.2 })}
      ${blush(78, 122, 86)}
      ${mouth(100, 92, 6, 3)}
      <path d="M82 50 q-4 -12 4 -16 M118 50 q4 -12 -4 -16" fill="none" stroke="${p.gold}" stroke-width="3" stroke-linecap="round"/>
      <path d="M56 114 q-10 -4 -12 -12 q12 0 16 8 M144 114 q10 -4 12 -12 q-12 0 -16 8" fill="${p.light}" opacity=".8"/>
      ${rand() < 0.5 ? `<circle cx="66" cy="106" r="4" fill="${p.gold}" opacity=".7"/><circle cx="132" cy="114" r="3" fill="${p.gold}" opacity=".7"/>` : ''}
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  /* ---------------- 鬼形 ---------------- */
  function ghost(p, seed, beast) {
    const rand = rng(seed + 53);
    const n = beast.n;
    const horned = /夜叉|修罗|鬼将|吸血|罗刹|魑|魍|魉|魔王/.test(n) || rand() < 0.35;
    const masked = /无常|僵尸|骷髅|鬼差|判官/.test(n);
    const talisman = /僵尸|无常|鬼差/.test(n) || rand() < 0.45;
    const face = masked
      ? `<ellipse cx="100" cy="88" rx="30" ry="32" fill="#e9e1cf" stroke="${INK}" stroke-width="4"/>
         <ellipse cx="88" cy="86" rx="7" ry="9" fill="${INK}"/><ellipse cx="112" cy="86" rx="7" ry="9" fill="${INK}"/>
         <circle cx="88" cy="84" r="1.6" fill="#fff" opacity=".7"/><circle cx="112" cy="84" r="1.6" fill="#fff" opacity=".7"/>
         <path d="M92 104 q8 6 16 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
         <path d="M84 74 l8 -4 M116 74 l-8 -4" stroke="${INK}" stroke-width="2.6"/>`
      : `<circle cx="100" cy="86" r="33" fill="${p.light}" stroke="${INK}" stroke-width="4"/>
         ${eyes(p, 86, 114, 84, { r: 7, pupil: 4.6, look: 0.4 })}
         ${blush(72, 126, 98)}
         ${mouth(100, 103, 8, 3)}
         <path d="M92 108 q4 8 8 0" fill="none" stroke="${INK}" stroke-width="2"/>`;
    return `${ground(p, 34)}
      <path d="M74 92 C52 96 44 118 50 136 C42 134 34 142 38 150 C48 152 54 148 58 158
               C62 172 76 178 100 174 C124 178 138 172 142 158 C146 148 152 152 162 150
               C166 142 158 134 150 136 C156 118 148 96 126 92 Z" fill="${p.deep}" opacity=".28"/>
      <path d="M78 88 C60 106 58 136 66 158 C72 174 84 176 100 172 C116 176 128 174 134 158
               C142 136 140 106 122 88 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M78 92 C70 112 72 136 80 154 C86 164 92 162 92 150 C92 126 84 108 90 92 Z" fill="${p.light}" opacity=".4"/>
      ${horned ? `<path d="M68 70 q-8 -22 2 -30 q6 14 10 24 M132 70 q8 -22 -2 -30 q-6 14 -10 24" fill="${p.gold}" stroke="${INK}" stroke-width="3.4"/>` : ''}
      ${face}
      ${talisman ? `<rect x="130" y="56" width="16" height="30" rx="2" fill="${p.red}" stroke="${INK}" stroke-width="2.4" transform="rotate(12 138 71)"/>
        <path d="M136 64 l6 4 -6 4 M134 76 l6 4 -6 4" fill="none" stroke="${p.gold}" stroke-width="1.6" transform="rotate(12 138 71)"/>` : ''}
      <path d="M84 156 q6 -12 12 0 q-6 10 -12 0 M108 158 q6 -12 12 0 q-6 10 -12 0" fill="${p.gold}" opacity=".7"/>
      <path d="M100 148 q-8 10 0 18 q8 -8 0 -18" fill="${p.red}" opacity=".75"/>
      ${rand() < 0.6 ? `<circle cx="58" cy="118" r="3" fill="${p.glow}"/><circle cx="146" cy="102" r="2.4" fill="${p.glow}"/>` : ''}
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  /* ---------------- 人形 ---------------- */
  function humanoid(p, seed, beast) {
    const rand = rng(seed + 67);
    const n = beast.n;
    const lady = /女娲|仙子|天女|神女|灵仙|公主|夫人|龙女|涂山|嫦娥|织女/.test(n) || (!/僧|罗汉|将军|护卫|武士|判官|童子|娃娃/.test(n) && rand() < 0.35);
    const warrior = /将军|护卫|武士|判官|大王|金刚|力士|天兵|天将/.test(n);
    const monk = /僧|罗汉/.test(n);
    const child = /童子|娃娃/.test(n);

    let headExtra = '';
    if (monk) {
      headExtra = `<circle cx="88" cy="52" r="2" fill="${p.gold}" opacity=".8"/><circle cx="100" cy="46" r="2" fill="${p.gold}" opacity=".8"/><circle cx="112" cy="52" r="2" fill="${p.gold}" opacity=".8"/>`;
    } else if (warrior) {
      headExtra = `<path d="M70 62 C70 36 86 28 100 28 C114 28 130 36 130 62 Z" fill="${p.gold}" stroke="${INK}" stroke-width="3.4"/>
        <path d="M100 28 C92 16 100 8 108 10 C112 18 108 24 100 28 Z" fill="${p.red}" stroke="${INK}" stroke-width="2.4"/>
        <path d="M70 58 q-6 10 0 16 M130 58 q6 10 0 16" fill="none" stroke="${p.goldDark}" stroke-width="4"/>`;
    } else if (lady) {
      headExtra = `<circle cx="100" cy="30" r="10" fill="${INK}"/>
        <path d="M73 66 C70 42 86 34 100 34 C114 34 130 42 127 66 C120 52 112 48 100 48 C88 48 78 56 73 66 Z" fill="${INK}"/>
        <path d="M92 26 l16 -10 M108 26 l-4 -14" stroke="${p.gold}" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="86" cy="18" r="3.4" fill="${p.red}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M74 62 q-10 20 -6 34 M126 62 q10 20 6 34" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    } else if (child) {
      headExtra = `<circle cx="76" cy="34" r="11" fill="${INK}"/><circle cx="124" cy="34" r="11" fill="${INK}"/>
        <path d="M73 66 C73 44 86 36 100 36 C114 36 127 44 127 66 C118 54 110 50 100 50 C90 50 82 54 73 66 Z" fill="${INK}"/>
        <path d="M70 28 q-4 -8 2 -10 M130 28 q4 -8 -2 -10" fill="none" stroke="${p.gold}" stroke-width="2" stroke-linecap="round"/>`;
    } else {
      headExtra = `<path d="M73 66 C72 40 88 32 100 32 C114 32 128 42 127 66 C120 52 112 48 100 48 C88 48 78 56 73 66 Z" fill="${INK}"/>
        <path d="M100 32 q-2 -12 8 -14 M100 32 q2 -12 -8 -14" fill="none" stroke="${p.gold}" stroke-width="2.4"/>
        <circle cx="100" cy="24" r="4" fill="${p.gold}" stroke="${INK}" stroke-width="1.6"/>`;
    }

    let robe = '';
    if (warrior) {
      robe = `<ellipse cx="66" cy="124" rx="17" ry="13" fill="${p.gold}" stroke="${INK}" stroke-width="3" transform="rotate(-24 66 124)"/>
        <ellipse cx="134" cy="124" rx="17" ry="13" fill="${p.gold}" stroke="${INK}" stroke-width="3" transform="rotate(24 134 124)"/>
        <path d="M80 132 h40 M78 144 h44 M82 158 h36" stroke="${p.goldDark}" stroke-width="2" opacity=".65"/>
        <circle cx="100" cy="138" r="6" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>`;
    } else if (monk) {
      robe = `<path d="M74 118 C62 136 56 158 52 176 L148 176 C144 158 138 136 126 118 Z" fill="${p.main}" opacity=".55"/>
        <path d="M78 120 C92 132 108 132 122 120" fill="none" stroke="${p.gold}" stroke-width="2.4"/>
        <circle cx="100" cy="132" r="3" fill="${p.gold}"/><circle cx="92" cy="140" r="3" fill="${p.gold}"/><circle cx="108" cy="140" r="3" fill="${p.gold}"/>`;
    } else if (lady) {
      robe = `<path d="M70 120 C50 138 42 164 36 178 C58 176 74 166 82 148 Z" fill="${p.light}" opacity=".45"/>
        <path d="M130 120 C150 138 158 164 164 178 C142 176 126 166 118 148 Z" fill="${p.light}" opacity=".45"/>
        <path d="M58 154 q42 13 84 0" fill="none" stroke="${p.gold}" stroke-width="1.8" opacity=".6"/>
        <path d="M66 166 q20 -8 34 2 q-16 6 -34 -2 M102 168 q18 -10 32 -2 q-14 6 -32 2" fill="${p.gold}" opacity=".35"/>`;
    } else if (child) {
      robe = `<path d="M78 122 q22 10 44 0" fill="none" stroke="${p.red}" stroke-width="5"/>
        <circle cx="100" cy="130" r="4" fill="${p.gold}" stroke="${INK}" stroke-width="1.4"/>`;
    }

    let acc = '';
    if (/剑|刀|将军|武士|判官/.test(n)) {
      acc = `<path d="M62 142 L44 176" stroke="${p.gold}" stroke-width="5" stroke-linecap="round"/>
        <path d="M58 146 l10 -10" stroke="${p.red}" stroke-width="4" stroke-linecap="round"/>
        <path d="M44 176 l-4 6" stroke="${p.goldDark}" stroke-width="6" stroke-linecap="round"/>`;
    } else if (/扇|公主|夫人|仙子/.test(n) && rand() < 0.7) {
      acc = `<path d="M132 128 a22 22 0 0 1 0 30 Z" fill="${p.light}" stroke="${p.gold}" stroke-width="2" transform="rotate(-20 132 143)"/>
        <path d="M132 128 l-14 30" stroke="${p.gold}" stroke-width="2"/>`;
    } else if (!warrior && !monk) {
      acc = `<circle cx="100" cy="142" r="9" fill="${p.glow}" opacity=".55"/>
        <path d="M100 132 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 Z" fill="${p.gold}"/>`;
    }

    return `${ground(p, 38)}
      <circle cx="100" cy="86" r="62" fill="none" stroke="${p.gold}" stroke-width="1.6" opacity=".32" stroke-dasharray="3 7"/>
      ${acc}
      <path d="M70 118 C54 138 50 164 44 176 L156 176 C150 164 146 138 130 118 Z" fill="${p.main}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M84 118 L100 176 L116 118 Z" fill="${p.light}" opacity=".9"/>
      <path d="M86 118 L100 152 L114 118" fill="none" stroke="${p.deep}" stroke-width="2" opacity=".5"/>
      ${robe}
      <path d="M58 156 q42 12 84 0" fill="none" stroke="${p.red}" stroke-width="7"/>
      <path d="M58 156 q42 12 84 0" fill="none" stroke="${p.gold}" stroke-width="1.6" opacity=".7"/>
      <circle cx="100" cy="70" r="27" fill="#f6e3c8" stroke="${INK}" stroke-width="4"/>
      ${headExtra}
      ${eyes(p, 89, 111, 70, { r: 5.4, pupil: 3.4 })}
      <path d="M100 72 l-2 5 2 1 2 -1 Z" fill="${p.red}" opacity=".5"/>
      ${mouth(100, 82, 4.4, 2.6)}
      ${blush(79, 121, 79)}
      <circle cx="100" cy="112" r="5" fill="${p.gold}" stroke="${INK}" stroke-width="1.8"/>
      <path d="M100 117 l-4 8 4 -2 4 2 Z" fill="${p.red}"/>
      <path d="M74 138 q-6 16 -2 26 M126 138 q6 16 2 26" fill="none" stroke="${p.gold}" stroke-width="1.6" opacity=".55"/>
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  /* ---------------- 鱼形 ---------------- */
  function fish(p, seed) {
    return `${ground(p, 42)}
      <path d="M58 116 C26 100 18 118 30 138 C18 148 30 166 58 148 Z" fill="${p.deep}" stroke="${INK}" stroke-width="3.6"/>
      <path d="M96 78 C110 54 128 52 136 62 C128 72 120 82 116 92 Z" fill="${p.main}" stroke="${INK}" stroke-width="3.4"/>
      <ellipse cx="106" cy="120" rx="48" ry="33" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <path d="M66 128 q40 20 80 0 q-10 22 -40 22 q-30 0 -40 -22 Z" fill="${p.light}" opacity=".95"/>
      <path d="M96 90 q10 4 10 14 M112 88 q8 8 8 18 M80 96 q10 4 10 14" fill="none" stroke="${p.deep}" stroke-width="2" opacity=".5"/>
      <path d="M74 142 q-8 14 -2 22 q10 -4 12 -14 Z" fill="${p.deep}" stroke="${INK}" stroke-width="3"/>
      <path d="M130 142 q8 14 2 22 q-10 -4 -12 -14 Z" fill="${p.deep}" stroke="${INK}" stroke-width="3"/>
      ${eyes(p, 118, 140, 112, { r: 7.4, look: 0.5 })}
      ${blush(104, 152, 128)}
      <path d="M140 130 q6 4 10 2" fill="none" stroke="${INK}" stroke-width="2.4"/>
      <path d="M100 100 q-6 -8 -14 -4 M120 96 q4 -10 12 -8" fill="none" stroke="${p.gold}" stroke-width="2.4" opacity=".7"/>
      <circle cx="154" cy="92" r="3" fill="${p.glow}" opacity=".7"/>
      <circle cx="164" cy="76" r="2" fill="${p.glow}" opacity=".6"/>
      <circle cx="146" cy="70" r="1.6" fill="${p.glow}" opacity=".5"/>
      ${p.variant ? sparkles(p, 4) : ''}`;
  }

  /* ---------------- 花灵 ---------------- */
  function plant(p, seed) {
    const rand = rng(seed + 83);
    const petals = 7;
    let petalsSvg = '';
    for (let i = 0; i < petals; i++) {
      const a = (360 / petals) * i + rand() * 6;
      petalsSvg += `<ellipse cx="100" cy="44" rx="13" ry="24" fill="${i % 2 ? p.light : p.main}" stroke="${INK}" stroke-width="3" transform="rotate(${a} 100 78)"/>`;
    }
    return `${ground(p, 34)}
      <path d="M100 150 C96 164 92 172 88 178" fill="none" stroke="${p.deep}" stroke-width="7" stroke-linecap="round"/>
      <path d="M98 158 C80 152 68 158 60 170 C76 174 90 170 100 162 Z" fill="${p.main}" stroke="${INK}" stroke-width="3.4"/>
      <path d="M104 164 C122 158 134 164 142 176 C126 180 112 176 102 168 Z" fill="${p.deep}" stroke="${INK}" stroke-width="3.4"/>
      <path d="M100 150 C84 144 72 146 64 154" fill="none" stroke="${p.deep}" stroke-width="3" opacity=".6"/>
      ${petalsSvg}
      <circle cx="100" cy="78" r="30" fill="${p.light}" stroke="${INK}" stroke-width="4"/>
      <circle cx="100" cy="78" r="30" fill="none" stroke="${p.gold}" stroke-width="1.4" opacity=".5" stroke-dasharray="2 5"/>
      ${eyes(p, 88, 112, 76, { r: 6.4 })}
      ${blush(78, 122, 88)}
      ${mouth(100, 90, 6, 3)}
      <path d="M100 48 q-4 -10 2 -14 q6 6 2 14" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>
      <circle cx="72" cy="112" r="3" fill="${p.gold}" opacity=".7"/>
      <circle cx="128" cy="116" r="2.4" fill="${p.gold}" opacity=".6"/>
      ${p.variant ? sparkles(p, 6) : ''}`;
  }

  /* ---------------- 石灵 ---------------- */
  function golem(p, seed) {
    const rand = rng(seed + 97);
    return `${ground(p, 50)}
      <path d="M62 172 L52 148 L60 126 L78 118 L82 96 L118 96 L124 118 L142 128 L148 152 L138 172 Z" fill="${p.deep}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M78 126 L86 118 L96 124 L104 116 L116 124 L124 134 L120 160 L80 160 L74 140 Z" fill="${p.main}"/>
      <path d="M84 136 l14 8 l10 -10 M90 154 l12 -8 l14 6" fill="none" stroke="${p.gold}" stroke-width="2.6" opacity=".85"/>
      <path d="M48 128 l-12 14 4 18 14 4 6 -16 Z" fill="${p.main}" stroke="${INK}" stroke-width="3.8"/>
      <path d="M152 128 l12 14 -4 18 -14 4 -6 -16 Z" fill="${p.main}" stroke="${INK}" stroke-width="3.8"/>
      <path d="M76 92 L68 66 L84 74 L90 54 L100 74 L110 54 L116 74 L132 66 L124 92 Z" fill="${p.main}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      ${eyes(p, 88, 112, 84, { r: 5.6, pupil: 3.4 })}
      <path d="M92 96 q8 5 16 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <path d="M84 74 l-4 -10 M116 74 l4 -10" stroke="${p.gold}" stroke-width="3" stroke-linecap="round"/>
      <path d="M64 156 q4 10 12 12 M136 156 q-4 10 -12 12" fill="none" stroke="${p.light}" stroke-width="2" opacity=".6"/>
      ${rand() < 0.6 ? `<path d="M56 108 q-8 -6 -6 -14 M144 108 q8 -6 6 -14" fill="none" stroke="${p.glow}" stroke-width="2" opacity=".6"/>` : ''}
      ${p.variant ? sparkles(p, 4) : ''}`;
  }

  /* ---------------- 蛙形 ---------------- */
  function frog(p, seed) {
    return `${ground(p, 50)}
      <ellipse cx="100" cy="150" rx="54" ry="25" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="100" cy="150" rx="40" ry="16" fill="${p.light}" opacity=".9"/>
      <path d="M62 132 q-18 4 -20 18 q16 4 24 -6 M138 132 q18 4 20 18 q-16 4 -24 -6" fill="${p.deep}" stroke="${INK}" stroke-width="3.2"/>
      <ellipse cx="100" cy="112" rx="46" ry="36" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <circle cx="76" cy="88" r="19" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
      <circle cx="124" cy="88" r="19" fill="${p.main}" stroke="${INK}" stroke-width="4"/>
      ${eyes(p, 76, 124, 86, { r: 9, pupil: 4.6, look: 0.3 })}
      <path d="M78 110 q22 16 44 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="86" cy="72" r="3" fill="${p.glow}" opacity=".7"/>
      <circle cx="114" cy="70" r="2.4" fill="${p.glow}" opacity=".6"/>
      <path d="M56 124 q4 10 12 10 M144 124 q-4 10 -12 10" fill="none" stroke="${p.deep}" stroke-width="2" opacity=".5"/>
      <ellipse cx="60" cy="166" rx="18" ry="6" fill="${p.deep}" opacity=".4"/>
      <ellipse cx="140" cy="166" rx="18" ry="6" fill="${p.deep}" opacity=".4"/>
      ${p.variant ? sparkles(p, 4) : ''}`;
  }

  /* ---------------- 法器 ---------------- */
  function artifact(p, seed, beast) {
    const n = beast.n;
    if (/伞/.test(n)) {
      return `${ground(p, 40)}
        <path d="M44 120 C44 64 156 64 156 120 Z" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
        <path d="M44 120 C72 108 128 108 156 120" fill="none" stroke="${p.gold}" stroke-width="3"/>
        <path d="M100 70 L100 120 M68 78 L78 120 M132 78 L122 120" stroke="${p.deep}" stroke-width="2.4" opacity=".7"/>
        <path d="M100 120 L100 168" stroke="${p.goldDark}" stroke-width="5" stroke-linecap="round"/>
        <path d="M100 168 q-10 0 -10 -8 q10 0 10 8" fill="${p.gold}" stroke="${INK}" stroke-width="2"/>
        ${eyes(p, 88, 112, 104, { r: 5.4 })}
        <path d="M94 116 q6 4 12 0" fill="none" stroke="${INK}" stroke-width="2.2"/>
        <circle cx="100" cy="80" r="5" fill="${p.red}"/>
        ${p.variant ? sparkles(p, 5) : ''}`;
    }
    if (/灯|炉|鼎/.test(n)) {
      return `${ground(p, 40)}
        <path d="M100 46 q-16 20 0 30 q16 -10 0 -30" fill="${p.glow}" opacity=".8"/>
        <rect x="66" y="76" width="68" height="72" rx="10" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
        <rect x="76" y="86" width="48" height="52" rx="6" fill="${p.light}" opacity=".55"/>
        <path d="M66 76 h68 M66 148 h68" stroke="${p.gold}" stroke-width="4"/>
        <path d="M100 154 v14 M88 168 h24" stroke="${p.goldDark}" stroke-width="4" stroke-linecap="round"/>
        ${eyes(p, 88, 112, 108, { r: 6 })}
        <path d="M94 120 q6 4 12 0" fill="none" stroke="${INK}" stroke-width="2.2"/>
        <path d="M56 60 q8 -8 16 0 M144 60 q-8 -8 -16 0" fill="none" stroke="${p.gold}" stroke-width="2" opacity=".6"/>
        ${p.variant ? sparkles(p, 5) : ''}`;
    }
    if (/镜/.test(n)) {
      return `${ground(p, 34)}
        <circle cx="100" cy="96" r="48" fill="${p.gold}" stroke="${INK}" stroke-width="4.5"/>
        <circle cx="100" cy="96" r="38" fill="${p.light}" stroke="${p.goldDark}" stroke-width="3"/>
        <path d="M100 96 m-28 0 a28 28 0 0 1 56 0 a28 28 0 0 1 -56 0" fill="${p.main}" opacity=".35"/>
        ${eyes(p, 88, 112, 94, { r: 6.4 })}
        <path d="M94 108 q6 5 12 0" fill="none" stroke="${INK}" stroke-width="2.2"/>
        <path d="M100 144 v22" stroke="${p.goldDark}" stroke-width="6" stroke-linecap="round"/>
        <path d="M88 170 h24" stroke="${p.red}" stroke-width="4" stroke-linecap="round"/>
        <path d="M100 40 l4 8 8 2 -8 3 -4 8 -4 -8 -8 -3 8 -2 Z" fill="${p.gold}"/>
        ${p.variant ? sparkles(p, 5) : ''}`;
    }
    return `${ground(p, 36)}
      <circle cx="100" cy="104" r="44" fill="${p.main}" stroke="${INK}" stroke-width="4.5"/>
      <circle cx="100" cy="104" r="34" fill="${p.light}" opacity=".55"/>
      <circle cx="100" cy="104" r="28" fill="${p.glow}" opacity=".45"/>
      ${eyes(p, 89, 111, 102, { r: 6 })}
      <path d="M94 114 q6 5 12 0" fill="none" stroke="${INK}" stroke-width="2.2"/>
      <path d="M100 60 l4 8 8 3 -8 3 -4 8 -4 -8 -8 -3 8 -3 Z" fill="${p.gold}"/>
      <path d="M62 150 q-8 10 -2 18 M138 150 q8 10 2 18" fill="none" stroke="${p.gold}" stroke-width="2" opacity=".6"/>
      ${p.variant ? sparkles(p, 6) : ''}`;
  }

  /* ---------------- 蛇形 ---------------- */
  function serpent(p, seed, beast) {
    const rand = rng(seed + 107);
    const hood = /眼镜|巴蛇|蛇魅/.test(beast.n) || rand() < 0.4;
    return `${ground(p, 48)}
      <path d="M50 164 C68 142 132 142 150 164" fill="none" stroke="${p.deep}" stroke-width="26" stroke-linecap="round"/>
      <path d="M50 164 C68 142 132 142 150 164" fill="none" stroke="${p.main}" stroke-width="17" stroke-linecap="round"/>
      <path d="M62 158 q38 -12 76 0" fill="none" stroke="${p.light}" stroke-width="5" opacity=".55"/>
      <path d="M100 108 C100 124 100 140 100 152" fill="none" stroke="${p.deep}" stroke-width="25" stroke-linecap="round"/>
      <path d="M100 108 C100 124 100 140 100 152" fill="none" stroke="${p.main}" stroke-width="17" stroke-linecap="round"/>
      <path d="M94 116 q6 4 0 9 M94 132 q6 4 0 9 M94 146 q6 4 0 9" fill="none" stroke="${p.light}" stroke-width="2.6" opacity=".65"/>
      ${hood ? `<path d="M62 88 C42 62 60 34 100 34 C140 34 158 62 138 88 C122 104 78 104 62 88 Z" fill="${p.deep}" stroke="${INK}" stroke-width="3.4" opacity=".9"/>
        <path d="M72 80 C60 62 72 44 100 44 C128 44 140 62 128 80" fill="none" stroke="${p.gold}" stroke-width="2" opacity=".55"/>` : ''}
      <ellipse cx="100" cy="76" rx="31" ry="28" fill="${p.main}" stroke="${INK}" stroke-width="4.4"/>
      <ellipse cx="100" cy="90" rx="20" ry="12" fill="${p.light}"/>
      ${eyes(p, 88, 112, 72, { r: 6.8, look: 0.4 })}
      ${blush(72, 128, 84)}
      <path d="M96 86 l4 -2 4 2 -4 4 Z" fill="${INK}"/>
      <path d="M100 94 l0 10 M100 104 l-7 7 M100 104 l7 7" fill="none" stroke="${p.red}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M92 98 l-2 6 M108 98 l2 6" stroke="#f3e9d2" stroke-width="3" stroke-linecap="round"/>
      <circle cx="72" cy="62" r="3" fill="${p.gold}" opacity=".7"/>
      <circle cx="128" cy="58" r="2.4" fill="${p.gold}" opacity=".6"/>
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  /* ---------------- 虫形 ---------------- */
  function insect(p, seed, beast) {
    const rand = rng(seed + 113);
    const winged = /蝶|蜂|蛾|萤/.test(beast.n);
    let wings = '';
    if (winged) {
      wings = `<ellipse cx="58" cy="112" rx="30" ry="20" fill="${p.light}" opacity=".55" stroke="${p.gold}" stroke-width="1.6" transform="rotate(-24 58 112)"/>
        <ellipse cx="142" cy="112" rx="30" ry="20" fill="${p.light}" opacity=".55" stroke="${p.gold}" stroke-width="1.6" transform="rotate(24 142 112)"/>
        <ellipse cx="64" cy="136" rx="22" ry="14" fill="${p.main}" opacity=".4" stroke="${p.gold}" stroke-width="1.4" transform="rotate(-34 64 136)"/>
        <ellipse cx="136" cy="136" rx="22" ry="14" fill="${p.main}" opacity=".4" stroke="${p.gold}" stroke-width="1.4" transform="rotate(34 136 136)"/>`;
    }
    const leg = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} q${x2 - x1} 8 ${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    return `${ground(p, 42)}
      ${wings}
      ${leg(78, 148, 64, 164)} ${leg(78, 158, 66, 172)} ${leg(122, 148, 136, 164)} ${leg(122, 158, 134, 172)}
      ${leg(84, 128, 68, 138)} ${leg(116, 128, 132, 138)}
      <ellipse cx="100" cy="154" rx="27" ry="21" fill="${p.deep}" stroke="${INK}" stroke-width="3.6"/>
      <ellipse cx="100" cy="130" rx="30" ry="24" fill="${p.main}" stroke="${INK}" stroke-width="3.6"/>
      <ellipse cx="100" cy="154" rx="15" ry="11" fill="${p.light}" opacity=".45"/>
      <circle cx="88" cy="126" r="4" fill="${p.deep}" opacity=".45"/>
      <circle cx="112" cy="134" r="3.4" fill="${p.deep}" opacity=".4"/>
      <path d="M86 118 C74 96 66 82 58 74 M114 118 C126 96 134 82 142 74" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="57" cy="72" r="4" fill="${p.gold}" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="143" cy="72" r="4" fill="${p.gold}" stroke="${INK}" stroke-width="1.4"/>
      <circle cx="100" cy="96" r="29" fill="${p.main}" stroke="${INK}" stroke-width="4.2"/>
      <ellipse cx="100" cy="108" rx="18" ry="11" fill="${p.light}"/>
      ${eyes(p, 89, 111, 94, { r: 7, look: 0.3 })}
      ${blush(76, 124, 104)}
      ${mouth(100, 110, 5, 3)}
      <path d="M100 68 l4 7 7 1 -7 3 -4 7 -4 -7 -7 -3 7 -1 Z" fill="${p.gold}" opacity=".9"/>
      ${rand() < 0.6 ? `<circle cx="72" cy="146" r="3" fill="${p.gold}" opacity=".6"/><circle cx="132" cy="150" r="2.4" fill="${p.gold}" opacity=".5"/>` : ''}
      ${p.variant ? sparkles(p, 5) : ''}`;
  }

  const TEMPLATES = { beast, bird, dragon, turtle, ghost, humanoid, fish, plant, golem, frog, artifact, serpent, insect };

  function svg(beast, opts) {
    opts = opts || {};
    if (!beast) return '';
    const seed = hash(String(beast.i) + beast.n);
    const p = palette(beast.el, seed, opts.variant);
    const tpl = opts.template || templateFor(beast);
    const body = (TEMPLATES[tpl] || beast)(p, seed, beast);
    const uid = 'p' + seed.toString(36) + (opts.variant ? 'v' : '');
    const size = opts.size || 200;
    const aura = opts.aura === false ? '' : `
      <circle cx="100" cy="96" r="76" fill="url(#aura-${uid})"/>
      <circle cx="100" cy="96" r="64" fill="none" stroke="${p.gold}" stroke-width="1" opacity=".28" stroke-dasharray="1 6"/>
      <circle cx="100" cy="96" r="72" fill="none" stroke="${p.deep}" stroke-width="1" opacity=".18"/>`;
    return `<svg class="portrait-svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${beast.n}${opts.variant ? '（变异）' : ''}立绘" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="aura-${uid}" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stop-color="${p.glow}" stop-opacity=".55"/>
          <stop offset="62%" stop-color="${p.glow}" stop-opacity=".16"/>
          <stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      ${aura}
      ${body}
    </svg>`;
  }

  window.Portraits = { svg, palette, templateFor, ELEMENT_BASE };
})();
