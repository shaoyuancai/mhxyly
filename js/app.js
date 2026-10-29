/* 梦幻洗宠模拟 · 兽栏中心版 */
(function () {
  'use strict';

  const E = window.Engine;
  const P = window.Portraits;
  const DATA = window.PET_DATA;
  const BEASTS = E.beasts;
  const UI_BEASTS = (() => {
    const map = new Map();
    BEASTS.forEach(b => {
      const prev = map.get(b.n);
      if (!prev || Number(b.lv) > Number(prev.lv)) map.set(b.n, b);
    });
    return Array.from(map.values());
  })();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORE_KEY = 'mh_pettrain_v2';
  const OLD_KEY = 'mh_pettrain_v1';
  const MAX_STABLE = 30;

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nowTime = () => new Date().toTimeString().slice(0, 5);
  const fmt = n => E.formatNum(n);

  const ITEM_KEYS = ['goldenDew', 'superGoldenDew', 'pureBottleDew', 'superPureBottleDew', 'bubbleBlessing'];

  const DEFAULTS = () => ({
    pets: [],
    selectedId: null,
    candidate: null,
    compareBase: null,
    candidateApplied: false,
    fusionMainId: null,
    fusionSubId: null,
    lastFusion: null,
    bests: {},
    discovered: {},
    history: [],
    bookLogs: [],
    logs: [],
    stats: {
      washes: 0, books: 0, fusions: 0, targetHits: 0, maxBatch: 0,
      added: 0, deleted: 0, items: {}, booksUsed: {},
    },
    settings: { times: 1, target: 5, autoKeep: true, variant: false, sound: true, tab: 'stable' },
    achievements: {},
    flags: { maxSkills: 0, maxGrowth: 0, variant: false, bestScore: 0, openedSlot: false, fusionSuccess: false },
    selectedBook: '高级必杀',
  });

  let state = DEFAULTS();
  let busy = false;
  let saveTimer = null;
  let bookQuery = '';
  let speciesQuery = '';
  let speciesLevel = 'all';
  let stablePickMode = 'wash';

  /* ================= 存档 ================= */
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 2,
        pets: state.pets,
        selectedId: state.selectedId,
        candidate: state.candidate,
        compareBase: state.compareBase,
        candidateApplied: state.candidateApplied,
        fusionMainId: state.fusionMainId,
        fusionSubId: state.fusionSubId,
        lastFusion: state.lastFusion,
        bests: state.bests,
        discovered: state.discovered,
        history: state.history.slice(0, 40),
        bookLogs: state.bookLogs.slice(0, 30),
        logs: state.logs.slice(0, 120),
        stats: state.stats,
        settings: state.settings,
        achievements: state.achievements,
        flags: state.flags,
        selectedBook: state.selectedBook,
      }));
    } catch (e) { /* 本地存储不可用时静默 */ }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 160);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    persist();
  }

  function migrate(old) {
    const pets = [];
    const seen = new Set();
    [old.current, ...(old.box || [])].forEach(p => {
      if (!p || !E.getBeast(p.bid) || seen.has(p.id)) return;
      seen.add(p.id);
      pets.push(p);
    });
    const booksUsed = {};
    (old.bookLogs || []).forEach(l => {
      const text = String(l.text || '');
      for (const name of Object.keys(DATA.skills)) {
        if (text.startsWith(name)) { booksUsed[name] = (booksUsed[name] || 0) + 1; break; }
      }
    });
    const items = {};
    const itemNames = { 金柳露: 'goldenDew', 超级金柳露: 'superGoldenDew', 净瓶玉露: 'pureBottleDew', 超级净瓶玉露: 'superPureBottleDew', 泡泡祈福石: 'bubbleBlessing' };
    (old.history || []).forEach(h => {
      const m = String(h.text || '').match(/^(超级净瓶玉露|超级金柳露|净瓶玉露|金柳露|泡泡祈福石)\s*×\s*(\d+)/);
      if (m && itemNames[m[1]]) items[itemNames[m[1]]] = (items[itemNames[m[1]]] || 0) + Number(m[2]);
    });
    return {
      pets,
      selectedId: (old.current && pets.some(p => p.id === old.current.id)) ? old.current.id : (pets[0] ? pets[0].id : null),
      bests: old.bests || {},
      discovered: old.discovered || {},
      history: old.history || [],
      bookLogs: old.bookLogs || [],
      logs: (old.ledger || []).map(l => ({ time: l.time, kind: l.kind || 'other', label: l.kindLabel || '操作', text: l.title || l.desc || '' })),
      stats: {
        washes: (old.totals && old.totals.washes) || 0,
        books: (old.totals && old.totals.books) || 0,
        fusions: (old.totals && old.totals.fusions) || 0,
        targetHits: (old.totals && old.totals.targetHits) || 0,
        maxBatch: (old.totals && old.totals.maxBatch) || 0,
        added: pets.length,
        deleted: 0,
        items,
        booksUsed,
      },
      settings: Object.assign({ times: 1, target: 5, autoKeep: true, variant: false, sound: true }, old.settings || {}, { tab: 'stable' }),
      achievements: old.achievements || {},
      flags: Object.assign({ maxSkills: 0, maxGrowth: 0, variant: false, bestScore: 0, openedSlot: false, fusionSuccess: false }, old.flags || {}),
      selectedBook: old.selectedBook || '高级必杀',
    };
  }

  function load() {
    try {
      let data = null;
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) data = JSON.parse(raw);
      if (!data) {
        const oldRaw = localStorage.getItem(OLD_KEY);
        if (!oldRaw) return false;
        data = migrate(JSON.parse(oldRaw));
      }
      if (!data) return false;
      const base = DEFAULTS();
      state = Object.assign(base, data);
      state.settings = Object.assign(base.settings, data.settings || {});
      state.stats = Object.assign(base.stats, data.stats || {});
      state.stats.items = Object.assign({}, (data.stats && data.stats.items) || {});
      state.stats.booksUsed = Object.assign({}, (data.stats && data.stats.booksUsed) || {});
      state.flags = Object.assign(base.flags, data.flags || {});
      state.pets = Array.isArray(state.pets) ? state.pets : [];
      state.history = Array.isArray(state.history) ? state.history : [];
      state.bookLogs = Array.isArray(state.bookLogs) ? state.bookLogs : [];
      state.logs = Array.isArray(state.logs) ? state.logs : [];
      normalize();
      return true;
    } catch (e) {
      return false;
    }
  }

  function normalize() {
    const seen = new Set();
    state.pets = state.pets.filter(p => p && E.getBeast(p.bid)).map(p => {
      if (!p.id || seen.has(p.id)) p.id = E.uid();
      seen.add(p.id);
      p.score = E.scorePet(p);
      p.grade = E.gradeOf(p).key;
      return p;
    }).slice(0, MAX_STABLE);
    if (state.selectedId && !state.pets.some(p => p.id === state.selectedId)) state.selectedId = null;
    if (state.selectedId === undefined) state.selectedId = state.pets[0] ? state.pets[0].id : null;
    if (!state.pets.some(p => p.id === state.fusionMainId)) state.fusionMainId = null;
    if (!state.pets.some(p => p.id === state.fusionSubId) || state.fusionSubId === state.fusionMainId) state.fusionSubId = null;
    if (state.candidate && (!state.compareBase || state.compareBase.id !== state.selectedId)) {
      state.candidate = null;
      state.compareBase = null;
      state.candidateApplied = false;
    }
    if (state.lastFusion && (!state.lastFusion.pet || !E.getBeast(state.lastFusion.pet.bid) || !state.pets.some(p => p.id === state.lastFusion.pet.id))) state.lastFusion = null;
  }

  function newGame() {
    state = DEFAULTS();
    const vampire = E.getBeast('吸血鬼');
    const tear = E.getBeast('泪妖');
    state.pets = [E.buildPet(vampire), E.buildPet(tear)];
    state.pets.forEach(p => { p.origin = '兽栏'; });
    state.selectedId = state.pets[0].id;
    state.stats.added = 2;
    state.settings.tab = 'stable';
    state.bests[state.pets[0].bid] = Math.max(state.bests[state.pets[0].bid] || 0, state.pets[0].score);
    state.bests[state.pets[1].bid] = Math.max(state.bests[state.pets[1].bid] || 0, state.pets[1].score);
    save();
  }

  /* ================= 基础工具 ================= */
  function petById(id) { return state.pets.find(p => p.id === id) || null; }
  function selectedPet() { return petById(state.selectedId); }
  function itemUsed(key) { return Number(state.stats.items[key]) || 0; }
  function bookUsed(name) { return Number(state.stats.booksUsed[name]) || 0; }
  function collectedSpecies() {
    const set = new Set(state.pets.map(p => String(p.bid)));
    Object.keys(state.discovered).forEach(k => set.add(String(k)));
    return set;
  }

  function pushLog(kind, text) {
    const labels = { add: '增加', delete: '删除', wash: '洗炼', book: '打书', fusion: '炼妖' };
    state.logs.unshift({ time: nowTime(), kind, label: labels[kind] || '操作', text });
    state.logs = state.logs.slice(0, 120);
  }

  function clearCandidate() {
    state.candidate = null;
    state.compareBase = null;
    state.candidateApplied = false;
  }

  function selectPet(id) {
    if (!petById(id)) return;
    if (state.selectedId !== id) clearCandidate();
    state.selectedId = id;
  }

  function addPetFromBeast(beast) {
    if (!beast) return null;
    if (state.pets.length >= MAX_STABLE) { toast(`兽栏已满（最多 ${MAX_STABLE} 只）`, 'bad'); return null; }
    const pet = E.buildPet(beast);
    pet.origin = '兽栏';
    state.pets.push(pet);
    state.stats.added += 1;
    state.selectedId = pet.id;
    clearCandidate();
    state.bests[pet.bid] = Math.max(state.bests[pet.bid] || 0, pet.score);
    pushLog('add', `增加 ${pet.name}（${pet.skills.length} 技能 · ${fmt(pet.score)} 分）`);
    toast(`已加入兽栏：${pet.name}`, 'good');
    checkAchievements();
    return pet;
  }

  function deletePet(id) {
    const pet = petById(id);
    if (!pet) return;
    state.pets = state.pets.filter(p => p.id !== id);
    state.stats.deleted += 1;
    if (state.selectedId === id) {
      state.selectedId = null;
      clearCandidate();
    }
    if (state.fusionMainId === id) state.fusionMainId = null;
    if (state.fusionSubId === id) state.fusionSubId = null;
    if (state.lastFusion && state.lastFusion.pet && state.lastFusion.pet.id === id) state.lastFusion = null;
    pushLog('delete', `删除 ${pet.name}`);
    toast(`已删除 ${pet.name}`);
    Sfx.play('tap');
    renderAll();
    save();
  }

  /* ================= UI 基础 ================= */
  function toast(message, type) {
    const stack = $('#toastStack');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2400);
    while (stack.children.length > 4) stack.firstElementChild.remove();
  }

  function openModal(opts) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${opts.title || ''}</h3><button class="modal-close" data-close aria-label="关闭">×</button></div>
      <div class="modal-body">${opts.body || ''}</div>
    </div>`;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    Sfx.play('open');
  }

  function closeModal() {
    const root = $('#modalRoot');
    root.hidden = true;
    root.innerHTML = '';
    document.body.style.overflow = '';
  }

  function portraitOf(pet, size) {
    if (!pet) return '';
    if (pet.name === '野生召唤兽') return P.svg({ i: 'wild', n: '野生召唤兽', el: '土' }, { size: size || 200, template: 'beast' });
    const beast = E.getBeast(pet.bid);
    return beast ? P.svg(beast, { size: size || 200, variant: pet.variant }) : '';
  }

  function beastPortrait(beast, size, variant) {
    return beast ? P.svg(beast, { size: size || 200, variant: !!variant }) : '';
  }

  function gradeBadge(pet) {
    if (!pet) return '<span class="grade-badge">—</span>';
    const g = E.gradeOf(pet);
    return `<span class="grade-badge" data-grade="${g.key}" title="${g.label} · 完成度 ${(g.ratio * 100).toFixed(1)}%">${g.key} ${g.label}</span>`;
  }

  function setGradeBadge(selector, pet) {
    const el = $(selector);
    if (!el) return;
    el.outerHTML = gradeBadge(pet).replace('class="grade-badge"', `class="grade-badge" id="${el.id}"`);
  }

  function roleName(role) { return DATA.roles[role] || '均衡'; }

  function petSubtitle(pet) {
    if (!pet) return '';
    const b = E.getBeast(pet.bid);
    return `${roleName(b.r)} · ${b.el} · 参战 ${b.lv} 级`;
  }

  function itemIcon(key) {
    const tones = {
      goldenDew: ['#a8ddb2', '#3f7d55', '#e8f7e0'],
      superGoldenDew: ['#f0cf86', '#a9792c', '#fff1c9'],
      pureBottleDew: ['#a9dbe6', '#3f7d8f', '#e3f8fb'],
      superPureBottleDew: ['#c9b0e6', '#6a4d92', '#f1e4ff'],
      bubbleBlessing: ['#f0a9bd', '#98405f', '#ffe1ea'],
      locked: ['#8a7a68', '#4a3f34', '#c9bba8'],
    };
    const c = tones[key] || tones.goldenDew;
    return `<svg viewBox="0 0 48 58" aria-hidden="true">
      <ellipse cx="24" cy="53" rx="13" ry="3.4" fill="#000" opacity=".3"/>
      <rect x="19" y="2" width="10" height="7" rx="2" fill="#8a5d32" stroke="#2b1d13" stroke-width="1.6"/>
      <path d="M20 8 h8 v6 c9 4 13 13 10 22 c-2 9 -9 15 -14 15 s-12 -6 -14 -15 c-3 -9 1 -18 10 -22 z" fill="${c[0]}" stroke="#2b1d13" stroke-width="2"/>
      <path d="M14 34 c0 10 5 14 10 14 s10 -4 10 -14 c0 -3 -2 -6 -4 -7 v9 c0 4 -12 4 -12 0 v-9 c-2 1 -4 4 -4 7 z" fill="${c[1]}" opacity=".65"/>
      <path d="M18 23 c-3 5 -3 11 0 15" fill="none" stroke="${c[2]}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <circle cx="24" cy="37" r="4.6" fill="${c[2]}" stroke="#2b1d13" stroke-width="1.2"/>
      <path d="M24 33 l1.3 2.8 3 .4 -2.2 2 .6 3 -2.7 -1.5 -2.7 1.5 .6 -3 -2.2 -2 3 -.4 z" fill="${c[1]}"/>
      <path d="M33 18 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" fill="${c[2]}" opacity=".85"/>
      <circle cx="12" cy="22" r="1.5" fill="${c[2]}" opacity=".7"/>
    </svg>`;
  }

  function skillChip(name, opts) {
    opts = opts || {};
    const meta = E.skillMeta(name);
    return `<span class="skill-chip${opts.isNew ? ' is-new' : ''}${opts.removed ? ' is-removed' : ''}" data-cat="${meta.category}" data-tier="${meta.tier}" title="${esc(name)} · ${meta.label} · ${meta.category}">
      <i class="dot"></i><span>${esc(name)}</span></span>`;
  }
  function emptyChip() { return '<span class="skill-chip is-empty"><span>空</span></span>'; }
  function bestOf(pet) { return pet ? (state.bests[pet.bid] || 0) : 0; }

  /* ================= 渲染：顶栏 / 兽栏 ================= */
  function renderHeader() {
    $('#stableCount').textContent = state.pets.length;
    const sound = $('#soundBtn');
    sound.setAttribute('aria-pressed', state.settings.sound ? 'true' : 'false');
    sound.textContent = state.settings.sound ? '音' : '静';
  }

  function renderStable() {
    $('#stableTotal').textContent = state.pets.length;
    const grid = $('#stableGrid');
    const cards = state.pets.map(pet => {
      const selected = pet.id === state.selectedId;
      return `<article class="pet-card${selected ? ' is-selected' : ''}" data-pet="${pet.id}" tabindex="0" role="button" aria-label="打开 ${esc(pet.name)} 的操作菜单">
        <div class="pc-portrait">${portraitOf(pet, 96)}</div>
        <div class="pc-main">
          <div class="pc-top">
            <b>${esc(pet.name)}</b>
            ${pet.variant ? '<span class="tag variant-tag">变异</span>' : ''}
            ${selected ? '<span class="pc-selected">已选</span>' : ''}
          </div>
          <div class="pc-meta">${petSubtitle(pet)}</div>
          <div class="pc-tags">${gradeBadge(pet)}<span class="tag">${pet.skills.length} 技能</span></div>
          <div class="pc-stats">
            <span>评分 <b>${fmt(pet.score)}</b></span>
            <span>成长 <b>${pet.growth.toFixed(3)}</b></span>
          </div>
        </div>
      </article>`;
    }).join('');
    const addCard = state.pets.length < MAX_STABLE
      ? `<button class="pet-add-card" data-add-pet><span class="plus">＋</span><b>增加召唤兽</b><small>从万灵谱挑选</small></button>`
      : `<div class="pet-add-card full"><span class="plus">满</span><b>兽栏已满</b><small>最多 ${MAX_STABLE} 只</small></div>`;
    grid.innerHTML = state.pets.length ? cards + addCard : `<div class="stable-empty">
      <div class="require-seal">栏</div>
      <b>兽栏还是空的</b>
      <p>先从万灵谱中增加一只召唤兽，然后就可以洗炼、打书和炼妖。</p>
      <button class="seal-button" data-add-pet><span class="seal-main">增加第一只召唤兽</span></button>
    </div>`;
  }

  /* ================= 渲染：洗炼 ================= */
  function renderWash() {
    const pet = selectedPet();
    const require = $('#washRequire');
    const grid = $('#washGrid');
    if (!pet) {
      require.hidden = false;
      grid.hidden = true;
      return;
    }
    require.hidden = true;
    grid.hidden = false;
    const beast = E.getBeast(pet.bid);

    $('#washPortrait').innerHTML = portraitOf(pet, 86);
    $('#washName').textContent = pet.name;
    $('#washVariantTag').hidden = !pet.variant;
    $('#washMeta').textContent = petSubtitle(pet);
    setGradeBadge('#washGrade', pet);
    $('#washElement').textContent = beast.el + '属性';
    $('#washElement').className = 'element-tag el-' + beast.el;
    $('#washScore').textContent = fmt(pet.score);
    $('#washGrowth').textContent = pet.growth.toFixed(3);
    $('#washSkills').textContent = pet.skills.length;

    $('#stagePortrait').innerHTML = portraitOf(pet, 320);
    $('#stageName').textContent = pet.name;
    $('#stageLine').textContent = `成长 ${pet.growth.toFixed(3)} · ${pet.skills.length} 技能 · 评分 ${fmt(pet.score)}`;
    $('#bestScore').textContent = fmt(Math.max(bestOf(pet), pet.score));

    const item = E.washItemFor(beast, state.settings.variant);
    const used = itemUsed(item.key);
    const times = state.settings.times;
    $('#washItemIcon').innerHTML = itemIcon(item.key);
    $('#washItemName').textContent = item.name;
    $('#washItemUsed').textContent = `累计使用 ${used} 次`;
    $('#washItemCount').textContent = `本次 ×${times}`;
    $('#washItemRule').textContent = item.rule || '';
    $('#washVariantToggle').checked = !!state.settings.variant;
    $('#washVariantLine').style.display = beast.w && !/泡泡/.test(beast.n) ? '' : 'none';

    $$('#timesSeg button').forEach(b => b.classList.toggle('is-active', Number(b.dataset.v) === times));
    $('#targetVal').textContent = state.settings.target;
    const targetMax = Math.min(12, new Set([...(beast.inn || []), ...(beast.opt || [])]).size);
    $('#targetMax').textContent = targetMax ? `/ 最多 ${targetMax}` : '';
    $('#autoKeep').checked = !!state.settings.autoKeep;
    $('#washPreviewTimes').textContent = times;
    $('#washPreviewItem').textContent = `${item.name} ×${times}`;
    $('#washPreviewUsed').textContent = `累计使用 ${used} 次 · 洗炼 ${state.stats.washes} 次`;
    $('#washBtnCount').textContent = `${times} 次`;
    $('#washBtn').disabled = busy || !beast.w;
    $('#washBtn').classList.toggle('is-busy', busy);
    $('#stageChangeBtn').disabled = busy;

    renderResult();
    renderWashHistory();
  }

  function resultAptRows(pet, base) {
    const beast = E.getBeast(pet.bid);
    return E.aptRanges(beast).map(r => {
      const value = pet.apt[r.key] || 0;
      const percent = clamp(((value / r.max - 0.72) / 0.28) * 100, 5, 100);
      const delta = base ? value - (base.apt[r.key] || 0) : null;
      const cls = percent >= 92 ? 'max' : percent >= 72 ? 'high' : '';
      const deltaHtml = delta == null ? '' : `<span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}">${delta > 0 ? '+' : ''}${delta}</span>`;
      return `<div class="apt-row" title="${r.name}资质 ${value} / 上限 ${r.max}">
        <span class="apt-name">${r.name}</span>
        <span class="apt-bar ${cls}" style="--pct:${percent.toFixed(1)}%"><i style="width:${percent.toFixed(1)}%"></i></span>
        <span class="apt-val">${fmt(value)}</span>
        ${deltaHtml || '<span class="delta flat"></span>'}
      </div>`;
    }).join('');
  }

  function resultSkillGrid(pet, base) {
    const total = 12;
    const added = base ? pet.skills.filter(s => !base.skills.includes(s)) : [];
    const cells = pet.skills.slice(0, total).map(s => skillChip(s, { isNew: added.includes(s) }));
    while (cells.length < total) cells.push(emptyChip());
    return cells.slice(0, total).join('');
  }

  function renderResult() {
    const panel = $('#resultPanel');
    const pet = state.candidate || selectedPet();
    if (!pet) {
      panel.innerHTML = `<div class="result-empty"><div class="big-seal">鉴</div><p>先选择一只召唤兽。</p></div>`;
      return;
    }
    const base = state.candidate ? state.compareBase : null;
    const beast = E.getBeast(pet.bid);
    const isCandidate = !!state.candidate;
    const applied = state.candidateApplied;
    const cmp = isCandidate ? E.compare(pet, base) : null;
    const grewToMax = pet.growth >= E.growthRange(beast).max - 0.0001;
    const target = state.settings.target;
    const reached = pet.skills.length >= target;
    const removed = cmp ? cmp.skills.removed : [];

    const header = `<div class="result-head">
      <h3>${isCandidate ? '洗炼结果' : '当前资质'}</h3>
      <div class="head-right">
        ${applied ? '<span class="tag" style="color:#8fce9d;border-color:rgba(143,206,157,.4)">已替换</span>' : ''}
        ${gradeBadge(pet)}
      </div>
    </div>`;

    const growthDelta = cmp ? `<span class="delta ${cmp.growth > 0 ? 'up' : cmp.growth < 0 ? 'down' : 'flat'}">${cmp.growth > 0 ? '+' : ''}${cmp.growth.toFixed(3)}</span>` : '';
    const range = E.growthRange(beast);
    const scoreDelta = cmp ? `<span class="score-delta delta ${cmp.score > 0 ? 'up' : cmp.score < 0 ? 'down' : 'flat'}">${cmp.score > 0 ? '+' : ''}${fmt(cmp.score)}</span>` : '';

    const body = `<div class="result-body">
      <div class="result-name-line">
        <div class="result-ident">
          <div class="result-portrait">${portraitOf(pet, 52)}</div>
          <div><b>${esc(pet.name)}</b>${pet.variant ? '<span class="tag variant-tag" style="margin-left:5px">变异</span>' : ''}</div>
        </div>
        <span>${roleName(beast.r)} · ${beast.el} · 参战 ${beast.lv}</span>
      </div>
      <div class="growth-row">
        <span class="label">成长</span>
        <span class="value">${pet.growth.toFixed(3)}</span>
        ${growthDelta}
        <span class="range">${range.min.toFixed(3)} – ${range.max.toFixed(3)}</span>
      </div>
      <div class="apt-list">${resultAptRows(pet, base)}</div>
      <div class="skill-head">
        <span>技能 · 目标 ${target} 格</span>
        <b class="${reached ? 'reached' : ''}">${pet.skills.length} / 12 ${reached ? '· 已达成' : ''}</b>
      </div>
      <div class="skill-grid">${resultSkillGrid(pet, base)}</div>
      ${removed.length ? `<div class="removed-row"><span>顶掉</span>${removed.map(s => skillChip(s, { removed: true })).join('')}</div>` : ''}
      ${grewToMax ? '<p class="compare-note" style="color:#f1d398">成长已达该召唤兽上限。</p>' : ''}
      <div class="result-score">
        <span class="score-label">综合评分</span>
        <span><span class="score-val">${fmt(pet.score)}</span>${scoreDelta}</span>
      </div>
      ${isCandidate ? `<div class="decision">
        ${applied
          ? `<button class="seal-button" data-action="washAgain"><span class="seal-main">继续洗炼</span><small>${state.settings.times} 次</small></button>
             <button class="ghost-btn" data-action="done">完成</button>`
          : `<button class="seal-button" data-action="keep"><span class="seal-main">替换当前</span><small>保留这只</small></button>
             <button class="ghost-btn" data-action="discard">放生</button>`}
      </div>` : '<p class="compare-note">洗炼后，在此对比资质、成长与技能变化。</p>'}
      ${base ? `<p class="compare-note">对比基准：洗炼前 ${esc(base.name)} · ${base.skills.length} 技能 · ${fmt(base.score)} 分</p>` : ''}
    </div>`;
    panel.innerHTML = header + body;
  }

  function renderWashHistory() {
    const list = $('#washHistory');
    $('#washCount').textContent = `${fmt(state.stats.washes)} 次`;
    if (!state.history.length) { list.innerHTML = '<li class="empty">还没有洗炼记录</li>'; return; }
    list.innerHTML = state.history.slice(0, 12).map(h => `<li>
      <span class="t">${h.time}</span>
      <span class="txt">${esc(h.text)} <em>${h.skills} 技</em>${h.kept ? ' · 保留' : ''}</span>
      <span class="val">${fmt(h.score)}</span>
    </li>`).join('');
  }

  /* ================= 渲染：打书 ================= */
  function renderBook() {
    const pet = selectedPet();
    const require = $('#bookRequire');
    const grid = $('#bookGrid');
    if (!pet) { require.hidden = false; grid.hidden = true; return; }
    require.hidden = true;
    grid.hidden = false;
    const beast = E.getBeast(pet.bid);
    $('#bookPortrait').innerHTML = portraitOf(pet, 86);
    $('#bookName').textContent = pet.name;
    $('#bookMeta').textContent = petSubtitle(pet);
    setGradeBadge('#bookGrade', pet);
    $('#bookSlotHint').textContent = `${pet.skills.length} / 12 技能`;
    $('#bookStagePortrait').innerHTML = portraitOf(pet, 230);
    renderBookSlots();
    renderBookList();
    renderSelectedBook();
    renderBookUsageTop();
    renderBookLog();
  }

  function renderBookSlots() {
    const pet = selectedPet();
    if (!pet) return;
    let html = pet.skills.slice(0, 12).map(s => skillChip(s)).join('');
    for (let i = pet.skills.length; i < 12; i++) html += emptyChip();
    $('#bookSlots').innerHTML = html;
  }

  function renderBookList() {
    const pet = selectedPet();
    const list = E.allBookSkills(pet ? pet.skills : []).filter(b => !bookQuery || b.name.includes(bookQuery) || b.category.includes(bookQuery));
    $('#bookCount').textContent = `${list.length} 本`;
    const wrap = $('#bookList');
    if (!list.length) { wrap.innerHTML = '<div class="empty-state"><p>没有匹配的兽决</p></div>'; return; }
    wrap.innerHTML = list.map(b => {
      const used = bookUsed(b.name);
      const flag = b.has ? '<span class="flag">已有</span>' : b.clash.length ? '<span class="flag">冲突</span>' : '';
      return `<button class="book-item${state.selectedBook === b.name ? ' is-active' : ''}" data-skill="${esc(b.name)}" data-cat="${b.category}" data-tier="${b.tier}" role="option">
        <span class="glyph">${{ 法术: '法', 物理: '物', 生存: '生', 辅助: '辅', 特殊: '特' }[b.category] || '技'}</span>
        <span class="nm">${esc(b.name)}<small>${b.label}</small>${flag}</span>
        <span class="pr">${used ? '×' + used : ''}</span>
      </button>`;
    }).join('');
  }

  function renderSelectedBook() {
    const panel = $('#selectedBookPanel');
    const pet = selectedPet();
    const name = state.selectedBook;
    if (!name || !DATA.skills[name]) {
      panel.innerHTML = '<div class="empty">从左侧选择一本兽决<br>查看冲突与使用次数</div>';
      $('#bookApplyCount').textContent = '—';
      $('#bookApplyBtn').disabled = true;
      return;
    }
    const meta = E.skillMeta(name);
    const has = pet && pet.skills.includes(name);
    const clash = pet ? pet.skills.filter(s => E.conflictsOf(name).includes(s)) : [];
    const used = bookUsed(name);
    panel.innerHTML = `<div class="sel-book-body">
      <div class="title"><b>${esc(name)}</b><span class="tag">${meta.label}</span></div>
      <div class="meta"><span class="tag">${meta.category}</span>${has ? '<span class="tag" style="color:#8fce9d">已拥有</span>' : ''}</div>
      <div class="sel-usage">已使用 <b>${used}</b> 次</div>
      ${clash.length ? `<div class="conflict">冲突：将顶掉 ${clash.map(esc).join('、')}。互斥技能不能共存。</div>` : '<div class="conflict" style="border-color:rgba(143,206,157,.35);color:#a9d5b3;background:rgba(80,140,100,.06)">无冲突。技能格未满时有 25% 概率开出新格。</div>'}
      <p class="desc">打书后当前召唤兽的技能与评分会立即变化。若技能栏已满，将随机顶掉一个技能。</p>
    </div>`;
    $('#bookApplyCount').textContent = `第 ${used + 1} 次`;
    $('#bookApplyBtn').disabled = !pet;
  }

  function renderBookUsageTop() {
    const el = $('#bookUsageTop');
    if (!el) return;
    const rows = Object.entries(state.stats.booksUsed || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN')).slice(0, 6);
    el.innerHTML = rows.length ? rows.map(([name, n]) => {
      const meta = E.skillMeta(name);
      return `<div class="usage-row"><span class="usage-dot" data-cat="${meta.category}"></span><b>${esc(name)}</b><span>×${n}</span></div>`;
    }).join('') : '<div class="usage-empty">还没有打书记录</div>';
  }

  function renderBookLog() {
    const el = $('#bookLog');
    if (!state.bookLogs.length) {
      el.innerHTML = '<div class="empty-state"><p>打书结果会显示在这里。</p></div>';
      if ($('#bookHistory')) $('#bookHistory').innerHTML = '<li class="empty">还没有打书记录</li>';
      return;
    }
    el.innerHTML = state.bookLogs.slice(0, 6).map(l => `<div class="log-line ${l.type || ''}"><span class="time">${l.time}</span><span>${esc(l.text)}</span></div>`).join('');
    if ($('#bookHistory')) {
      $('#bookHistory').innerHTML = state.bookLogs.slice(0, 8).map(l => `<li>
        <span class="t">${l.time}</span>
        <span class="txt" title="${esc(l.text)}">${esc(l.text)}</span>
      </li>`).join('');
    }
  }

  /* ================= 渲染：炼妖 ================= */
  function fillFusionSlot(el, pet, label, role) {
    el.className = 'fusion-slot ' + role + (pet ? '' : ' empty');
    if (!pet) {
      el.innerHTML = `<span class="slot-label">${label}</span><div class="plus-mark">＋</div><p>从兽栏选择${label}</p>`;
      return;
    }
    const beast = E.getBeast(pet.bid);
    el.innerHTML = `<span class="slot-label">${label}</span>
      <div class="fusion-portrait">${portraitOf(pet, 190)}</div>
      <div class="fname">${esc(pet.name)}</div>
      <div class="fmeta">${roleName(beast.r)} · 成长 ${pet.growth.toFixed(3)} · ${fmt(pet.score)} 分</div>
      <div class="fskills">${pet.skills.slice(0, 4).map(s => `<span>${esc(s)}</span>`).join('')}${pet.skills.length > 4 ? `<span>+${pet.skills.length - 4}</span>` : ''}</div>`;
  }

  function renderFusion() {
    const require = $('#fusionRequire');
    const grid = $('#fusionGrid');
    if (!state.pets.length) {
      require.hidden = false;
      grid.hidden = true;
      return;
    }
    if (state.pets.length < 2 && !state.lastFusion) {
      require.hidden = false;
      grid.hidden = true;
      return;
    }
    require.hidden = true;
    grid.hidden = false;

    if (!state.fusionMainId || !petById(state.fusionMainId)) {
      state.fusionMainId = state.selectedId || state.pets[0].id;
    }
    if (state.fusionSubId && (!petById(state.fusionSubId) || state.fusionSubId === state.fusionMainId)) {
      state.fusionSubId = null;
    }
    const main = petById(state.fusionMainId);
    const sub = petById(state.fusionSubId);
    fillFusionSlot($('#fusionMain'), main, '主宠', 'slot-main');
    fillFusionSlot($('#fusionSub'), sub, '副宠', 'slot-sub');
    $('#fuseBtn').disabled = !main || !sub || busy;
    $('#fusionStableCount').textContent = `${state.pets.length} 只`;
    const roster = $('#fusionRoster');
    roster.innerHTML = state.pets.map(p => `<div class="roster-card${p.id === (main && main.id) ? ' is-main' : ''}${p.id === (sub && sub.id) ? ' is-sub' : ''}">
      <div class="roster-portrait">${portraitOf(p, 52)}</div>
      <div class="roster-main">
        <b>${esc(p.name)}</b>
        <span>${p.skills.length} 技 · ${fmt(p.score)} 分</span>
        <div class="roster-tags">
          ${p.id === (main && main.id) ? '<em>主</em>' : ''}
          ${p.id === (sub && sub.id) ? '<em>副</em>' : ''}
        </div>
      </div>
      <div class="roster-buttons">
        <button data-set-main="${p.id}" title="设为主宠">主</button>
        <button data-set-sub="${p.id}" title="设为副宠">副</button>
      </div>
    </div>`).join('');
    renderFusionResult();
  }

  function renderFusionResult() {
    const wrap = $('#fusionResult');
    const res = state.lastFusion;
    if (!res) { wrap.innerHTML = ''; return; }
    const pet = res.pet;
    const beast = E.getBeast(pet.bid);
    wrap.innerHTML = `<div class="panel fusion-card">
      <div class="fusion-title">
        <h3>${esc(res.title)}</h3>
        ${gradeBadge(pet)}
        <span class="tag" style="${res.success ? 'color:#8fce9d;border-color:rgba(143,206,157,.4)' : 'color:#e08b7a;border-color:rgba(207,89,64,.45)'}">${res.success ? '炼妖成功' : '炼妖失败'}</span>
      </div>
      <div class="result-body">
        <div class="fusion-result-main">
          <div class="fr-portrait">${portraitOf(pet, 104)}</div>
          <div class="fr-info">
            <div class="result-name-line"><b>${esc(pet.name)}</b><span>${roleName(beast.r)} · ${beast.el} · 已收入兽栏</span></div>
            <div class="growth-row" style="margin-top:8px"><span class="label">成长</span><span class="value">${pet.growth.toFixed(3)}</span><span class="range">${fmt(pet.score)} 分 · ${pet.skills.length} 技能</span></div>
            <div class="skill-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:8px">${pet.skills.slice(0, 8).map(s => skillChip(s)).join('') || '<span class="compare-note">无技能</span>'}</div>
          </div>
        </div>
        <p class="compare-note">${esc(res.note)}</p>
        <div class="decision">
          <button class="seal-button" data-goto="stable"><span class="seal-main">查看兽栏</span><small>结果已入栏</small></button>
          ${state.pets.length >= 2
            ? '<button class="ghost-btn" data-action="fusionAgain">继续炼妖</button>'
            : '<button class="ghost-btn" data-goto="stable">前往兽栏</button>'}
        </div>
      </div>
    </div>`;
  }

  /* ================= 渲染：图鉴 ================= */
  function levelList() {
    return Array.from(new Set(UI_BEASTS.map(b => b.lv))).sort((a, b) => a - b);
  }

  let albumLimit = 48;
  let albumRole = '';
  let albumLevel = 'all';

  function renderAlbum() {
    const levels = levelList();
    $('#levelChips').innerHTML = `<button class="chip${albumLevel === 'all' ? ' is-active' : ''}" data-level="all">全部</button>` +
      levels.map(l => `<button class="chip${String(albumLevel) === String(l) ? ' is-active' : ''}" data-level="${l}">${l} 级</button>`).join('');
    const q = $('#albumSearch').value.trim().toLowerCase();
    const list = UI_BEASTS.filter(b => {
      if (albumRole && b.r !== albumRole) return false;
      if (albumLevel !== 'all' && String(b.lv) !== String(albumLevel)) return false;
      if (!q) return true;
      return (b.n + ' ' + b.sc + ' ' + (b.inn || []).join(' ') + ' ' + (b.opt || []).join(' ')).toLowerCase().includes(q);
    }).sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n, 'zh-Hans-CN'));
    $('#albumTotal').textContent = UI_BEASTS.length;
    $('#albumSeen').textContent = collectedSpecies().size;
    const shown = list.slice(0, albumLimit);
    const grid = $('#albumGrid');
    if (!shown.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><b>查无此兽</b><p>换个名字或技能试试。</p></div>';
    } else {
      grid.innerHTML = shown.map(b => {
        const best = state.bests[b.i] || 0;
        const owned = state.pets.filter(p => String(p.bid) === String(b.i)).length;
        return `<div class="album-card" data-bid="${b.i}" role="button" tabindex="0" title="查看 ${esc(b.n)}">
          ${b.w ? '' : '<span class="lock-tag">神兽</span>'}
          <div class="ap">${beastPortrait(b, 110)}</div>
          <div class="an">${esc(b.n)}</div>
          <div class="am"><span>${b.lv}级</span><span>·</span><span>${roleName(b.r)}</span><span>·</span><span>${b.el}</span></div>
          <div class="abest${best || owned ? '' : ' none'}">${owned ? `兽栏 ${owned} 只` : best ? `最佳 ${fmt(best)}` : '未收集'}</div>
        </div>`;
      }).join('');
    }
    const more = $('#albumMoreBtn');
    more.style.display = list.length > albumLimit ? '' : 'none';
    more.textContent = `加载更多（${Math.min(list.length, albumLimit)} / ${list.length}）`;
  }

  /* ================= 渲染：记录 ================= */
  const ACHIEVEMENTS = [
    { id: 'firstWash', seal: '初', name: '初入洗炼', desc: '完成第一次洗炼', when: () => state.stats.washes >= 1 },
    { id: 'fiveSkill', seal: '五', name: '五技能', desc: '洗出 5 技能召唤兽', when: () => state.flags.maxSkills >= 5 },
    { id: 'sixSkill', seal: '六', name: '六技能', desc: '洗出 6 技能召唤兽', when: () => state.flags.maxSkills >= 6 },
    { id: 'fullGrowth', seal: '满', name: '满成长', desc: '洗出成长上限', when: () => state.flags.maxGrowth >= 1 },
    { id: 'variant', seal: '异', name: '变异之姿', desc: '用净瓶玉露洗出变异', when: () => state.flags.variant },
    { id: 'hundredK', seal: '十', name: '十万评分', desc: '单宠评分达到 100000', when: () => state.flags.bestScore >= 100000 },
    { id: 'master', seal: '宗', name: '一代宗师', desc: '单宠评分达到 130000', when: () => state.flags.bestScore >= 130000 },
    { id: 'openSlot', seal: '格', name: '顶书开格', desc: '打书开出新技能格', when: () => state.flags.openedSlot },
    { id: 'allRed', seal: '红', name: '五红在身', desc: '拥有一只 5 个高级或特殊技能的召唤兽', when: () => state.pets.some(p => p.skills.filter(s => { const m = E.skillMeta(s); return m.tier === 'high' || m.tier === 'special'; }).length >= 5) },
    { id: 'fusion', seal: '炼', name: '炼妖有成', desc: '成功完成一次炼妖', when: () => state.flags.fusionSuccess },
    { id: 'collector', seal: '藏', name: '万灵收藏', desc: '收集 30 种召唤兽', when: () => collectedSpecies().size >= 30 },
    { id: 'fifty', seal: '连', name: '五十连洗', desc: '一次连续洗炼 50 次', when: () => state.stats.maxBatch >= 50 },
  ];

  function currentAchCount() { return ACHIEVEMENTS.filter(a => state.achievements[a.id]).length; }

  function checkAchievements() {
    ACHIEVEMENTS.forEach(a => {
      if (state.achievements[a.id]) return;
      let ok = false;
      try { ok = !!a.when(); } catch (e) { ok = false; }
      if (ok) {
        state.achievements[a.id] = Date.now();
        toast(`成就达成 · ${a.name}`, 'gold');
        Sfx.play('achievement');
      }
    });
  }

  function renderRecord() {
    const s = state.stats;
    $('#recordSummary').innerHTML = `
      <div class="sum-item"><span>兽栏</span><b>${state.pets.length}</b><small>只 / 最多 ${MAX_STABLE}</small></div>
      <div class="sum-item"><span>洗炼</span><b>${fmt(s.washes)}</b><small>次 · 达成目标 ${s.targetHits} 回</small></div>
      <div class="sum-item"><span>打书</span><b>${fmt(s.books)}</b><small>本</small></div>
      <div class="sum-item"><span>炼妖</span><b>${fmt(s.fusions)}</b><small>次</small></div>
      <div class="sum-item"><span>图鉴</span><b>${collectedSpecies().size}</b><small>种 / ${UI_BEASTS.length}</small></div>`;

    $('#itemUsage').innerHTML = ITEM_KEYS.map(key => {
      const item = E.ITEMS[key];
      const n = itemUsed(key);
      return `<div class="usage-row"><span class="usage-icon">${itemIcon(key)}</span><b>${item.name}</b><span>${n} 次</span></div>`;
    }).join('');

    const books = Object.entries(state.stats.booksUsed || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
    $('#bookUsageCount').textContent = `${books.length} 种`;
    $('#bookUsage').innerHTML = books.length ? books.slice(0, 20).map(([name, n]) => {
      const meta = E.skillMeta(name);
      return `<div class="usage-row"><span class="usage-dot" data-cat="${meta.category}"></span><b>${esc(name)}</b><span>×${n}</span></div>`;
    }).join('') : '<div class="usage-empty">还没有打书记录</div>';

    $('#achCount').textContent = `${currentAchCount()} / ${ACHIEVEMENTS.length}`;
    $('#achGrid').innerHTML = ACHIEVEMENTS.map(a => `<div class="ach${state.achievements[a.id] ? ' done' : ''}"><span class="seal">${a.seal}</span><div><b>${a.name}</b><span>${a.desc}</span></div></div>`).join('');

    const hall = Object.entries(state.bests).map(([bid, score]) => ({ beast: E.getBeast(bid), score })).filter(x => x.beast).sort((a, b) => b.score - a.score).slice(0, 6);
    $('#hallList').innerHTML = hall.length ? hall.map((h, i) => `<div class="hall-item">
      <span class="rank${i === 0 ? ' top' : ''}">${i + 1}</span>
      <span class="hp">${beastPortrait(h.beast, 40)}</span>
      <div><b>${esc(h.beast.n)}</b><span>${h.beast.lv}级 · ${roleName(h.beast.r)} · ${h.beast.el}</span></div>
      <span class="hs">${fmt(h.score)}</span>
    </div>`).join('') : '<div class="hall-empty">洗出高分召唤兽后，会记录在这里。</div>';

    $('#logCount').textContent = `${state.logs.length} 条`;
    $('#logList').innerHTML = state.logs.length ? state.logs.slice(0, 60).map(l => `<div class="ledger-row">
      <span class="lt">${l.time}</span>
      <span class="lk">${l.label}</span>
      <span class="ld" title="${esc(l.text)}">${esc(l.text)}</span>
    </div>`).join('') : '<div class="ledger-empty">还没有操作记录。</div>';
  }

  function renderAll() {
    renderHeader();
    renderStable();
    renderWash();
    renderBook();
    renderFusion();
    if (state.settings.tab === 'album') renderAlbum();
    if (state.settings.tab === 'record') renderRecord();
  }

  /* ================= 动作：洗炼 ================= */
  function spawnBubbles() {
    const fx = $('#waterFx');
    fx.innerHTML = '';
    for (let i = 0; i < 22; i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      const size = 6 + Math.random() * 26;
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.left = (8 + Math.random() * 84) + '%';
      b.style.animationDelay = (Math.random() * 0.5) + 's';
      b.style.animationDuration = (0.9 + Math.random() * 0.8) + 's';
      fx.appendChild(b);
    }
    setTimeout(() => { if (fx) fx.innerHTML = ''; }, 2200);
  }

  function noteFlags(pet) {
    state.flags.maxSkills = Math.max(state.flags.maxSkills || 0, pet.skills.length);
    state.flags.bestScore = Math.max(state.flags.bestScore || 0, pet.score);
    const beast = E.getBeast(pet.bid);
    if (pet.growth >= E.growthRange(beast).max - 0.0001) state.flags.maxGrowth = 1;
    if (pet.variant) state.flags.variant = true;
  }

  async function doWash() {
    if (busy) return;
    const pet = selectedPet();
    if (!pet) { toast('先从兽栏选择一只召唤兽', 'bad'); return; }
    const beast = E.getBeast(pet.bid);
    if (!beast || !beast.w) { toast('神兽不参与洗炼', 'bad'); return; }
    const variant = !!state.settings.variant;
    const item = E.washItemFor(beast, variant);
    if (item.key === 'locked') { toast(item.rule, 'bad'); return; }
    const times = clamp(Number(state.settings.times) || 1, 1, 50);
    const target = state.settings.target;
    const targetId = pet.id;
    const before = JSON.parse(JSON.stringify(pet));

    busy = true;
    $('#stageFrame').classList.add('is-washing');
    $('#washBtn').classList.add('is-busy');
    $('#washBtn').disabled = true;
    Sfx.play('wash');
    spawnBubbles();
    await sleep(780 + Math.min(times, 20) * 8);

    if (!petById(targetId) || state.selectedId !== targetId) {
      busy = false;
      $('#stageFrame').classList.remove('is-washing');
      $('#washBtn').classList.remove('is-busy');
      toast('召唤兽已更换，本次洗炼结果作废', 'bad');
      renderAll();
      return;
    }

    let best = null;
    let performed = 0;
    let hit = false;
    for (let i = 0; i < times; i++) {
      const rolled = E.buildPet(beast, { variant });
      performed++;
      noteFlags(rolled);
      if (!best || rolled.score > best.score) best = rolled;
      if (rolled.skills.length >= target) { best = rolled; hit = true; break; }
    }

    state.stats.washes += performed;
    state.stats.items[item.key] = (state.stats.items[item.key] || 0) + performed;
    state.stats.maxBatch = Math.max(state.stats.maxBatch || 0, performed);
    if (hit) state.stats.targetHits += 1;
    state.bests[best.bid] = Math.max(state.bests[best.bid] || 0, best.score);
    state.discovered[best.bid] = (state.discovered[best.bid] || 0) + 1;
    state.candidate = best;
    state.compareBase = before;
    state.candidateApplied = false;
    state.history.unshift({
      time: nowTime(), text: `${item.name} ×${performed}`, skills: best.skills.length,
      score: best.score, kept: false, name: best.name, growth: best.growth,
    });
    state.history = state.history.slice(0, 40);
    pushLog('wash', `${pet.name} 洗炼 ${performed} 次（${item.name}）· ${best.skills.length} 技能`);

    busy = false;
    $('#stageFrame').classList.remove('is-washing');
    $('#washBtn').classList.remove('is-busy');
    renderAll();
    Sfx.play(best.skills.length >= 5 || best.score > before.score + 8000 ? 'great' : 'reveal');

    if (hit) toast(`达成目标：${best.skills.length} 技能`, 'gold');
    else if (state.settings.autoKeep && times > 1 && best.score > before.score) {
      applyKeep(true);
    } else {
      toast(`洗炼完成 · 第 ${performed} 次结算`, 'good');
    }
    checkAchievements();
    save();
  }

  function applyKeep(auto) {
    if (!state.candidate) return;
    const idx = state.pets.findIndex(p => p.id === state.selectedId);
    if (idx < 0) { clearCandidate(); renderAll(); return; }
    const cand = Object.assign({}, state.candidate, { id: state.selectedId, origin: '洗炼' });
    state.pets[idx] = cand;
    state.candidate = cand;
    state.candidateApplied = true;
    state.bests[cand.bid] = Math.max(state.bests[cand.bid] || 0, cand.score);
    if (state.history[0]) state.history[0].kept = true;
    if (!auto) {
      toast('已替换为洗炼结果', 'good');
      Sfx.play('openSlot');
    } else {
      toast('已自动保留本次最高评分', 'good');
      Sfx.play('reveal');
    }
    renderAll();
    checkAchievements();
    save();
  }

  function discardCandidate() {
    if (!state.candidate) return;
    clearCandidate();
    toast('已放生，保留原来的召唤兽');
    Sfx.play('tap');
    renderAll();
    save();
  }

  /* ================= 动作：打书 ================= */
  function applyBookAction() {
    const pet = selectedPet();
    if (!pet) { toast('先从兽栏选择一只召唤兽', 'bad'); return; }
    const name = state.selectedBook;
    if (!name) { toast('请先选择一本兽决', 'bad'); return; }
    const result = E.applyBook(pet, name);
    if (!result.ok) { toast(result.desc, 'bad'); return; }
    clearCandidate();
    pet.skills = result.skills;
    pet.score = E.scorePet(pet);
    pet.grade = E.gradeOf(pet).key;
    state.stats.books += 1;
    state.stats.booksUsed[name] = (state.stats.booksUsed[name] || 0) + 1;
    state.bests[pet.bid] = Math.max(state.bests[pet.bid] || 0, pet.score);
    state.flags.openedSlot = state.flags.openedSlot || result.type === 'open';
    state.bookLogs.unshift({ time: nowTime(), text: result.desc, type: result.type === 'open' ? 'ok' : result.type === 'exists' ? 'warn' : '' });
    state.bookLogs = state.bookLogs.slice(0, 30);
    pushLog('book', `${pet.name} 打书 · ${name}（第 ${bookUsed(name)} 次）`);
    if (result.type === 'open') { toast('顶书开格！' + result.desc, 'gold'); Sfx.play('openSlot'); }
    else if (result.type === 'exists') { toast(result.desc, 'bad'); Sfx.play('tap'); }
    else { toast(result.desc, 'good'); Sfx.play('book'); }
    checkAchievements();
    renderAll();
    save();
  }

  /* ================= 动作：炼妖 ================= */
  function doFusion() {
    const main = petById(state.fusionMainId);
    const sub = petById(state.fusionSubId);
    if (!main) { toast('请先选择主宠', 'bad'); return; }
    if (!sub) { toast('请先选择副宠', 'bad'); return; }
    if (main.id === sub.id) { toast('主宠与副宠不能是同一只', 'bad'); return; }
    const result = E.fuse(main, sub);
    if (!result.ok) { toast(result.note || '炼妖失败', 'bad'); return; }
    state.pets = state.pets.filter(p => p.id !== main.id && p.id !== sub.id);
    const rp = result.pet;
    while (state.pets.some(p => p.id === rp.id)) rp.id = E.uid();
    rp.origin = '炼妖';
    state.pets.push(rp);
    state.stats.fusions += 1;
    if (result.success) state.flags.fusionSuccess = true;
    state.bests[rp.bid] = Math.max(state.bests[rp.bid] || 0, rp.score);
    state.selectedId = rp.id;
    state.fusionMainId = null;
    state.fusionSubId = null;
    state.lastFusion = result;
    clearCandidate();
    pushLog('fusion', `${main.name} + ${sub.name} → ${rp.name}（${rp.skills.length} 技能）`);
    toast(result.success ? `炼妖成功 · ${rp.name} 已入栏` : `炼妖失败 · ${rp.name} 已入栏`, result.success ? 'gold' : 'bad');
    Sfx.play(result.success ? 'fusion' : 'fail');
    checkAchievements();
    renderAll();
    save();
  }

  function fusionAgain() {
    state.lastFusion = null;
    state.fusionMainId = state.selectedId || (state.pets[0] && state.pets[0].id) || null;
    state.fusionSubId = null;
    renderFusion();
    save();
  }

  /* ================= 弹窗 ================= */
  function openPetActions(id) {
    const pet = petById(id);
    if (!pet) return;
    selectPet(id);
    renderStable();
    save();
    const beast = E.getBeast(pet.bid);
    openModal({
      title: '召唤兽 · ' + pet.name,
      body: `<div class="action-pet">
        <div class="action-portrait">${portraitOf(pet, 110)}</div>
        <div class="action-meta">
          <div class="pet-name-line"><b>${esc(pet.name)}</b>${pet.variant ? '<span class="tag variant-tag">变异</span>' : ''}</div>
          <div class="pet-sub">${petSubtitle(pet)}</div>
          <div class="tag-line">${gradeBadge(pet)}<span class="element-tag el-${beast.el}">${beast.el}属性</span></div>
          <div class="action-stats">
            <span>评分 <b>${fmt(pet.score)}</b></span>
            <span>成长 <b>${pet.growth.toFixed(3)}</b></span>
            <span>技能 <b>${pet.skills.length}</b></span>
          </div>
        </div>
      </div>
      <div class="action-grid">
        <button class="seal-button" data-pet-action="wash" data-id="${pet.id}"><span class="seal-main">洗炼</span><small>去洗炼台重掷</small></button>
        <button class="ghost-btn" data-pet-action="book" data-id="${pet.id}">打书</button>
        <button class="ghost-btn" data-pet-action="fusion" data-id="${pet.id}">炼妖</button>
        <button class="ghost-btn danger" data-pet-action="delete" data-id="${pet.id}">删除</button>
      </div>
      <p class="fine-print" style="padding:12px 0 0">洗炼、打书、炼妖都会直接作用于这只兽栏召唤兽。</p>`,
    });
  }

  function renderSpeciesGrid() {
    const grid = $('#speciesGrid');
    if (!grid) return;
    const q = speciesQuery.trim().toLowerCase();
    let list = UI_BEASTS.filter(b => {
      if (!b.w) return false;
      if (speciesLevel !== 'all' && String(b.lv) !== String(speciesLevel)) return false;
      if (!q) return true;
      return (b.n + ' ' + b.sc + ' ' + (b.inn || []).join(' ') + ' ' + (b.opt || []).join(' ')).toLowerCase().includes(q);
    });
    if (!q && speciesLevel === 'all') {
      const pop = DATA.popular.map(n => UI_BEASTS.find(b => b.n === n)).filter(Boolean);
      list = pop.concat(list.filter(b => !pop.includes(b)));
    }
    list = list.slice(0, 60);
    if (!list.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>没有找到匹配的召唤兽</p></div>'; return; }
    grid.innerHTML = list.map(b => `<div class="picker-card" data-pick-beast="${b.i}" role="button" tabindex="0">
      <div class="pp">${beastPortrait(b, 76)}</div>
      <div class="pn">${esc(b.n)}</div>
      <div class="pm">${b.lv}级 · ${roleName(b.r)} · ${b.el}</div>
    </div>`).join('');
    $('#speciesSearch').value = speciesQuery;
    $('#speciesLevel').value = speciesLevel;
  }

  function openAddPet() {
    speciesQuery = '';
    speciesLevel = 'all';
    const levels = levelList();
    openModal({
      title: '增加召唤兽',
      wide: true,
      body: `<div class="picker-tools">
        <input class="search-input" id="speciesSearch" type="search" placeholder="搜索名字、技能或场景" autocomplete="off">
        <select class="select" id="speciesLevel">
          <option value="all">全部等级</option>
          ${levels.map(l => `<option value="${l}">${l} 级</option>`).join('')}
        </select>
        <button class="ghost-btn" id="speciesRandom">随机一只</button>
      </div>
      <div class="picker-grid" id="speciesGrid"></div>
      <p class="fine-print">加入兽栏时会随机生成资质、成长与技能，不消耗道具。</p>`,
    });
    renderSpeciesGrid();
  }

  function openStablePicker(mode) {
    stablePickMode = mode;
    const titleMap = { wash: '选择要洗炼的召唤兽', book: '选择要打书的召唤兽', fusionMain: '选择主宠', fusionSub: '选择副宠' };
    const list = state.pets.filter(p => !(mode === 'fusionSub' && p.id === state.fusionMainId));
    if (!list.length) {
      openModal({
        title: titleMap[mode] || '选择召唤兽',
        body: `<div class="empty-state"><b>兽栏里没有可选的召唤兽</b><p>先去兽栏增加一只。</p></div>`,
      });
      return;
    }
    openModal({
      title: titleMap[mode] || '选择召唤兽',
      wide: true,
      body: `<div class="stable-pick-grid">${list.map(p => {
        const selected = (mode === 'wash' || mode === 'book') ? p.id === state.selectedId : (mode === 'fusionMain' ? p.id === state.fusionMainId : p.id === state.fusionSubId);
        return `<div class="stable-pick-card${selected ? ' is-selected' : ''}" data-pick-stable="${p.id}" role="button" tabindex="0">
          <div class="sp-portrait">${portraitOf(p, 80)}</div>
          <div class="sp-main"><b>${esc(p.name)}</b><span>${p.skills.length} 技 · ${fmt(p.score)} 分</span><span>${p.growth.toFixed(3)} 成长</span></div>
          ${selected ? '<span class="sp-check">✓</span>' : ''}
        </div>`;
      }).join('')}</div>
      <p class="fine-print">只列出兽栏中的召唤兽。</p>`,
    });
  }

  function openDetail(beast) {
    if (!beast) return;
    const ranges = E.aptRanges(beast);
    const gr = E.growthRange(beast);
    const owned = state.pets.filter(p => String(p.bid) === String(beast.i)).length;
    const full = state.pets.length >= MAX_STABLE;
    openModal({
      title: beast.n + ' · 召唤兽档案',
      wide: true,
      body: `<div class="detail-grid">
        <div class="detail-left">
          <div class="detail-portrait">${beastPortrait(beast, 240)}</div>
          <div class="dname">${esc(beast.n)}</div>
          <div class="dmeta">参战 ${beast.lv} 级 · ${roleName(beast.r)} · ${beast.el}属性</div>
          <div class="dmeta">${esc(beast.sc || '无固定场景')}</div>
          <div class="ddesc">${esc(beast.d || '暂无档案。')}</div>
        </div>
        <div class="detail-right">
          <h4>资质区间</h4>
          <table class="stat-table">
            ${ranges.map(r => `<tr><td>${r.name}</td><td class="bar-cell"><div class="mini-bar"><i style="width:${clamp((r.max / (r.max * 1.1)) * 100, 70, 100).toFixed(0)}%"></i></div></td><td>${fmt(r.min)} – ${fmt(r.max)}</td></tr>`).join('')}
            <tr><td>成长</td><td class="bar-cell"><div class="mini-bar"><i style="width:${clamp((gr.max / 1.35) * 100, 40, 100).toFixed(0)}%"></i></div></td><td>${gr.min.toFixed(3)} – ${gr.max.toFixed(3)}</td></tr>
          </table>
          <p class="detail-item">洗炼道具：${E.washItemFor(beast, false).name}</p>
          <h4>必带技能</h4>
          <div class="detail-skills">${(beast.inn || []).length ? beast.inn.map(s => skillChip(s)).join('') : '<span class="compare-note">无</span>'}</div>
          <h4>可选技能</h4>
          <div class="detail-skills">${(beast.opt || []).length ? beast.opt.map(s => skillChip(s)).join('') : '<span class="compare-note">无</span>'}</div>
          <div class="detail-actions">
            ${beast.w ? `<button class="seal-button" data-detail-add="${beast.i}" ${full ? 'disabled' : ''}><span class="seal-main">加入兽栏</span><small>兽栏已有 ${owned} 只</small></button>` : '<span class="tag">神兽 · 不可加入</span>'}
            ${full ? '<span class="tag">兽栏已满</span>' : ''}
          </div>
        </div>
      </div>`,
    });
  }

  function openHelp() {
    openModal({
      title: '玩法说明',
      body: `<div class="guide-steps">
        <div class="guide-step"><span class="n">一</span><div><b>在兽栏增加召唤兽</b><p>「兽栏」是唯一的召唤兽仓库。点击「增加召唤兽」从万灵谱挑选，随机生成资质、成长与技能。</p></div></div>
        <div class="guide-step"><span class="n">二</span><div><b>点击兽栏里的召唤兽</b><p>会弹出操作菜单：洗炼、打书、炼妖、删除。洗炼/打书/炼妖都会作用于这只召唤兽。</p></div></div>
        <div class="guide-step"><span class="n">三</span><div><b>洗炼与打书</b><p>洗炼重掷六项资质（21 档）、成长（5 档）与技能数量；结果满意就替换，不满意就放生。打书可开格或顶掉互斥技能。</p></div></div>
        <div class="guide-step"><span class="n">四</span><div><b>炼妖</b><p>主宠与副宠都必须从兽栏选择。炼妖会消耗两只召唤兽，结果自动收入兽栏。</p></div></div>
      </div>
      <div class="guide-note">所有界面只记录次数与用量：洗炼按道具统计，打书按兽决统计，炼妖按次数统计。快捷键：<b>S</b> 兽栏 · <b>W</b> 洗炼 · <b>B</b> 打书 · <b>F</b> 炼妖 · <b>Esc</b> 关闭弹窗。</div>`,
    });
  }

  function confirmModal(title, text, onOk, okText) {
    openModal({
      title,
      body: `<p style="font-size:13px;color:var(--muted);line-height:1.9">${text}</p>
      <div class="detail-actions" style="justify-content:flex-end">
        <button class="ghost-btn" data-close>取消</button>
        <button class="seal-button" id="confirmOk"><span class="seal-main">${okText || '确定'}</span></button>
      </div>`,
    });
    $('#confirmOk').addEventListener('click', () => { closeModal(); onOk(); });
  }

  /* ================= 标签页 ================= */
  function switchTab(tab) {
    state.settings.tab = tab;
    $$('.tab').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tab-panel').forEach(p => { p.hidden = p.id !== 'panel-' + tab; });
    if (tab === 'stable') renderStable();
    if (tab === 'wash') renderWash();
    if (tab === 'book') {
      renderBook();
      setTimeout(() => {
        const active = $('.book-item.is-active');
        if (active) active.scrollIntoView({ block: 'nearest' });
      }, 0);
    }
    if (tab === 'fusion') renderFusion();
    if (tab === 'album') renderAlbum();
    if (tab === 'record') renderRecord();
    if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: 'smooth' });
    save();
  }

  /* ================= 事件 ================= */
  function bind() {
    $$('.tab').forEach(btn => btn.addEventListener('click', () => { Sfx.play('tap'); switchTab(btn.dataset.tab); }));

    $('#addPetBtn').addEventListener('click', openAddPet);
    $('#fusionAddBtn').addEventListener('click', openAddPet);
    $('#washChangeBtn').addEventListener('click', () => openStablePicker('wash'));
    $('#stageChangeBtn').addEventListener('click', () => openStablePicker('wash'));
    $('#washGoStable').addEventListener('click', () => switchTab('stable'));
    $('#bookChangeBtn').addEventListener('click', () => openStablePicker('book'));

    $('#washBtn').addEventListener('click', doWash);
    $$('#timesSeg button').forEach(b => b.addEventListener('click', () => {
      state.settings.times = Number(b.dataset.v);
      Sfx.play('tap');
      renderWash();
      save();
    }));
    $('#targetDown').addEventListener('click', () => {
      state.settings.target = clamp(state.settings.target - 1, 1, 12);
      Sfx.play('tap');
      renderWash();
      save();
    });
    $('#targetUp').addEventListener('click', () => {
      state.settings.target = clamp(state.settings.target + 1, 1, 12);
      Sfx.play('tap');
      renderWash();
      save();
    });
    $('#washVariantToggle').addEventListener('change', e => {
      state.settings.variant = e.target.checked;
      Sfx.play('tap');
      renderWash();
      save();
    });
    $('#autoKeep').addEventListener('change', e => {
      state.settings.autoKeep = e.target.checked;
      save();
    });

    $('#resultPanel').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'keep') applyKeep(false);
      else if (btn.dataset.action === 'discard') discardCandidate();
      else if (btn.dataset.action === 'done') { clearCandidate(); renderAll(); save(); }
      else if (btn.dataset.action === 'washAgain') { clearCandidate(); doWash(); }
    });

    $('#bookSearch').addEventListener('input', e => {
      bookQuery = e.target.value.trim();
      renderBookList();
    });
    $('#bookList').addEventListener('click', e => {
      const item = e.target.closest('[data-skill]');
      if (!item) return;
      state.selectedBook = item.dataset.skill;
      $$('.book-item').forEach(b => b.classList.toggle('is-active', b === item));
      renderSelectedBook();
      item.scrollIntoView({ block: 'nearest' });
      Sfx.play('tap');
      save();
    });
    $('#bookApplyBtn').addEventListener('click', applyBookAction);
    $('#bookClearBtn').addEventListener('click', () => {
      state.selectedBook = '';
      renderSelectedBook();
      renderBookList();
    });

    $('#fusionMain').addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openStablePicker('fusionMain');
    });
    $('#fusionSub').addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openStablePicker('fusionSub');
    });
    $('#fuseBtn').addEventListener('click', doFusion);
    $('#fusionResetBtn').addEventListener('click', () => {
      state.fusionMainId = state.selectedId || (state.pets[0] && state.pets[0].id) || null;
      state.fusionSubId = null;
      renderFusion();
      save();
    });
    $('#fusionRoster').addEventListener('click', e => {
      const mainBtn = e.target.closest('[data-set-main]');
      const subBtn = e.target.closest('[data-set-sub]');
      if (mainBtn) {
        state.fusionMainId = mainBtn.dataset.setMain;
        if (state.fusionSubId === state.fusionMainId) state.fusionSubId = null;
        renderFusion();
        save();
      } else if (subBtn) {
        const id = subBtn.dataset.setSub;
        if (id === state.fusionMainId) { toast('主宠与副宠不能是同一只', 'bad'); return; }
        state.fusionSubId = id;
        renderFusion();
        save();
      }
    });
    $('#fusionResult').addEventListener('click', e => {
      const btn = e.target.closest('[data-action="fusionAgain"]');
      if (btn) fusionAgain();
    });

    let albumTimer = null;
    $('#albumSearch').addEventListener('input', () => {
      clearTimeout(albumTimer);
      albumTimer = setTimeout(() => { albumLimit = 48; renderAlbum(); }, 160);
    });
    $('#albumRole').addEventListener('change', e => {
      albumRole = e.target.value;
      albumLimit = 48;
      renderAlbum();
    });
    $('#levelChips').addEventListener('click', e => {
      const chip = e.target.closest('[data-level]');
      if (!chip) return;
      albumLevel = chip.dataset.level;
      albumLimit = 48;
      renderAlbum();
      Sfx.play('tap');
    });
    $('#albumGrid').addEventListener('click', e => {
      const card = e.target.closest('[data-bid]');
      if (!card) return;
      openDetail(E.getBeast(card.dataset.bid));
      Sfx.play('tap');
    });
    $('#albumMoreBtn').addEventListener('click', () => {
      albumLimit += 48;
      renderAlbum();
    });

    $('#exportBtn').addEventListener('click', exportSave);
    $('#resetBtn').addEventListener('click', () => {
      confirmModal('清空存档', '将删除兽栏、洗炼/打书/炼妖记录、成就与全部统计，且无法恢复。确定继续吗？', () => {
        try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ }
        newGame();
        renderAll();
        switchTab('stable');
        toast('存档已清空，已放入两只初始召唤兽');
      }, '清空');
    });

    $('#soundBtn').addEventListener('click', () => {
      state.settings.sound = !state.settings.sound;
      Sfx.setEnabled(state.settings.sound);
      if (state.settings.sound) Sfx.play('tap');
      renderHeader();
      save();
    });
    $('#helpBtn').addEventListener('click', openHelp);

    $('#stableGrid').addEventListener('click', e => {
      const add = e.target.closest('[data-add-pet]');
      if (add) { openAddPet(); return; }
      const card = e.target.closest('[data-pet]');
      if (card) { openPetActions(card.dataset.pet); Sfx.play('tap'); }
    });
    $('#stableGrid').addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-pet]');
      if (card) { e.preventDefault(); openPetActions(card.dataset.pet); }
    });

    document.addEventListener('click', e => {
      const goto = e.target.closest('[data-goto]');
      if (goto) { closeModal(); switchTab(goto.dataset.goto); }
    });

    $('#modalRoot').addEventListener('click', e => {
      if (e.target.id === 'modalRoot' || e.target.closest('[data-close]')) { closeModal(); return; }
      const petAction = e.target.closest('[data-pet-action]');
      if (petAction) {
        const id = petAction.dataset.id;
        const action = petAction.dataset.petAction;
        if (action === 'delete') {
          const pet = petById(id);
          confirmModal('删除召唤兽', `确定删除「${esc(pet ? pet.name : '')}」吗？删除后无法恢复。`, () => deletePet(id), '删除');
          return;
        }
        selectPet(id);
        closeModal();
        if (action === 'fusion') {
          state.fusionMainId = id;
          state.fusionSubId = null;
          state.lastFusion = null;
          switchTab('fusion');
        } else {
          switchTab(action);
        }
        renderAll();
        save();
        return;
      }
      const pickBeast = e.target.closest('[data-pick-beast]');
      if (pickBeast) {
        const pet = addPetFromBeast(E.getBeast(pickBeast.dataset.pickBeast));
        if (pet) {
          closeModal();
          switchTab('stable');
          renderAll();
          save();
        }
        return;
      }
      const pickStable = e.target.closest('[data-pick-stable]');
      if (pickStable) {
        const id = pickStable.dataset.pickStable;
        if (stablePickMode === 'wash' || stablePickMode === 'book') {
          selectPet(id);
          closeModal();
          switchTab(stablePickMode);
        } else if (stablePickMode === 'fusionMain') {
          state.fusionMainId = id;
          if (state.fusionSubId === id) state.fusionSubId = null;
          closeModal();
          renderFusion();
        } else if (stablePickMode === 'fusionSub') {
          state.fusionSubId = id;
          closeModal();
          renderFusion();
        }
        renderAll();
        save();
        return;
      }
      const detailAdd = e.target.closest('[data-detail-add]');
      if (detailAdd) {
        const pet = addPetFromBeast(E.getBeast(detailAdd.dataset.detailAdd));
        if (pet) {
          closeModal();
          switchTab('stable');
          renderAll();
          save();
        }
        return;
      }
      if (e.target.id === 'speciesRandom') {
        const b = E.pick(UI_BEASTS.filter(x => x.w));
        const pet = addPetFromBeast(b);
        if (pet) { closeModal(); switchTab('stable'); renderAll(); save(); }
      }
    });
    $('#modalRoot').addEventListener('input', e => {
      if (e.target.id === 'speciesSearch') { speciesQuery = e.target.value; renderSpeciesGrid(); }
    });
    $('#modalRoot').addEventListener('change', e => {
      if (e.target.id === 'speciesLevel') { speciesLevel = e.target.value; renderSpeciesGrid(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModal(); return; }
      if (!$('#modalRoot').hidden) return;
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 's' || e.key === 'S') switchTab('stable');
      if (e.key === 'w' || e.key === 'W') switchTab('wash');
      if (e.key === 'b' || e.key === 'B') switchTab('book');
      if (e.key === 'f' || e.key === 'F') switchTab('fusion');
    });

    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  }

  function exportSave() {
    try {
      const blob = new Blob([JSON.stringify({
        pets: state.pets, selectedId: state.selectedId, bests: state.bests, discovered: state.discovered,
        stats: state.stats, achievements: state.achievements, flags: state.flags, logs: state.logs,
      }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `梦幻洗宠存档-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('存档已导出', 'good');
    } catch (e) { toast('导出失败', 'bad'); }
  }

  /* ================= 启动 ================= */
  function boot() {
    if (/nofx/.test(location.search)) {
      const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
      document.head.appendChild(st);
    }
    const restored = load();
    if (!restored) newGame();
    Sfx.setEnabled(state.settings.sound !== false);
    bind();
    renderAll();
    switchTab(state.settings.tab || 'stable');
    if (!restored && !/nohint/.test(location.search)) setTimeout(openHelp, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
