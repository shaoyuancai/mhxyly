/* 核心数值引擎：洗练 / 打书 / 炼妖。公式参考梦幻西游公开玩法与官方宠物站数据。 */
(function () {
  'use strict';

  const D = window.PET_DATA;
  const APT = D.aptKeys;
  const APT_NAME = D.aptNames;
  const ITEMS = {
    goldenDew: { key: 'goldenDew', name: '金柳露', rule: '普通召唤兽 · 参战等级 < 95', tone: 'jade' },
    superGoldenDew: { key: 'superGoldenDew', name: '超级金柳露', rule: '普通召唤兽 · 参战等级 ≥ 95', tone: 'gold' },
    pureBottleDew: { key: 'pureBottleDew', name: '净瓶玉露', rule: '变异召唤兽 · 参战等级 < 95', tone: 'violet' },
    superPureBottleDew: { key: 'superPureBottleDew', name: '超级净瓶玉露', rule: '变异召唤兽 · 参战等级 ≥ 95', tone: 'violet' },
    bubbleBlessing: { key: 'bubbleBlessing', name: '泡泡祈福石', rule: '泡泡专属 · 特殊洗练', tone: 'rose' },
    locked: { key: 'locked', name: '不可洗练', rule: '神兽不参与洗宠模拟', tone: 'ink' },
  };
  const SKILL_COUNT_ODDS = [
    [0.18, 1], [0.48, 2], [0.74, 3], [0.9, 4], [0.975, 5], [1, 6],
  ];
  const COMMON_POOL = ['连击', '必杀', '偷袭', '夜战', '吸血', '防御', '幸运', '神佑复生', '感知', '敏捷', '魔之心', '法术暴击'];

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const randRange = (a, b) => Math.random() * (b - a) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const round3 = n => Math.round(n * 1000) / 1000;
  const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const beasts = D.beasts;
  const byId = new Map(beasts.map(b => [String(b.i), b]));
  const byName = new Map();
  beasts.forEach(b => { if (!byName.has(b.n)) byName.set(b.n, b); });

  function getBeast(idOrName) {
    if (!idOrName) return null;
    return byId.get(String(idOrName)) || byName.get(String(idOrName)) || null;
  }

  function aptRanges(beast) {
    return APT.map((k, i) => {
      const maxValue = beast.a[i * 2 + 1] || beast.a[i * 2];
      return { key: k, name: APT_NAME[k], min: beast.a[i * 2], max: maxValue };
    });
  }

  function growthRange(beast) {
    let [min, max] = beast.g || [1.2, 1.2];
    if (!(min < max)) { max = min; min = round3(max * 0.96); }
    const values = [];
    for (let i = 0; i < 5; i++) values.push(round3(min + ((max - min) / 4) * i));
    return { min, max, values };
  }

  function rollGrowth(beast) {
    const r = growthRange(beast);
    return r.values[randInt(0, r.values.length - 1)];
  }

  function rollApt(beast) {
    const out = {};
    aptRanges(beast).forEach(r => {
      const step = (r.max - r.min) / 20;
      out[r.key] = Math.round(r.min + step * randInt(0, 20));
    });
    return out;
  }

  function rollSkillCount(poolSize) {
    const r = Math.random();
    let n = 1;
    for (const [edge, value] of SKILL_COUNT_ODDS) { if (r < edge) { n = value; break; } }
    return Math.min(poolSize, n);
  }

  function rollSkills(beast) {
    const innate = uniq(beast.inn || []);
    const pool = uniq(innate.concat(beast.opt || []));
    const usable = pool.length ? pool : COMMON_POOL;
    const count = clamp(rollSkillCount(usable.length), innate.length, 12);
    const optional = usable.filter(s => !innate.includes(s));
    const need = Math.max(0, count - innate.length);
    const picked = [];
    while (picked.length < need && optional.length) {
      picked.push(optional.splice(randInt(0, optional.length - 1), 1)[0]);
    }
    let skills = innate.concat(picked).slice(0, 12);
    if (!skills.length) skills = [pick(usable)];
    return skills;
  }

  function scorePet(pet) {
    const avg = APT.reduce((s, k) => s + (Number(pet.apt[k]) || 0), 0) / APT.length;
    return Math.round(avg + (Number(pet.growth) || 1.2) * 12000 + (pet.skills || []).length * 18000);
  }

  function maxScoreOf(beast) {
    const avg = aptRanges(beast).reduce((s, r) => s + r.max, 0) / APT.length;
    const g = growthRange(beast).max;
    const pool = uniq((beast.inn || []).concat(beast.opt || []));
    const maxSkills = clamp(pool.length || 1, 1, 12);
    return avg + g * 12000 + maxSkills * 18000;
  }

  function gradeOf(pet) {
    const beast = getBeast(pet.bid);
    if (!beast) return { key: 'C', label: '凡品', ratio: 0 };
    const ratio = pet.score / maxScoreOf(beast);
    if (ratio >= 0.93) return { key: 'SSS', label: '天授', ratio };
    if (ratio >= 0.87) return { key: 'SS', label: '绝品', ratio };
    if (ratio >= 0.8) return { key: 'S', label: '上品', ratio };
    if (ratio >= 0.71) return { key: 'A', label: '良品', ratio };
    if (ratio >= 0.6) return { key: 'B', label: '中品', ratio };
    return { key: 'C', label: '凡品', ratio };
  }

  function buildPet(beast, opts = {}) {
    if (!beast) throw new Error('未知召唤兽');
    const variant = !!opts.variant;
    const apt = opts.apt ? Object.assign({}, opts.apt) : rollApt(beast);
    const growth = opts.growth != null ? round3(opts.growth) : rollGrowth(beast);
    const skills = (opts.skills ? uniq(opts.skills) : rollSkills(beast)).slice(0, 12);
    const pet = {
      id: opts.id || uid(),
      bid: String(beast.i),
      name: (variant ? '变异' : '') + beast.n,
      variant,
      element: opts.element || beast.el,
      level: Math.max(30, Number(beast.lv) || 0),
      baseLevel: Number(beast.lv) || 0,
      growth,
      apt,
      skills,
      life: opts.life || randInt(7200, 9800),
      bornAt: opts.bornAt || Date.now(),
      origin: opts.origin || '洗练',
    };
    pet.score = scorePet(pet);
    pet.grade = gradeOf(pet).key;
    return pet;
  }

  function clonePet(pet) {
    const copy = JSON.parse(JSON.stringify(pet));
    copy.id = uid();
    return copy;
  }

  function washItemFor(beast, variant) {
    if (!beast || !beast.w) return Object.assign({}, ITEMS.locked);
    if (/泡泡/.test(beast.n)) return Object.assign({}, ITEMS.bubbleBlessing);
    const high = (Number(beast.lv) || 0) >= 95;
    return Object.assign({}, variant ? (high ? ITEMS.superPureBottleDew : ITEMS.pureBottleDew) : (high ? ITEMS.superGoldenDew : ITEMS.goldenDew));
  }

  function compare(candidate, current) {
    if (!candidate) return null;
    if (!current) return { apt: {}, growth: 0, score: candidate.score, skills: { added: candidate.skills.slice(), removed: [] } };
    const apt = {};
    APT.forEach(k => { apt[k] = candidate.apt[k] - current.apt[k]; });
    return {
      apt,
      growth: round3(candidate.growth - current.growth),
      score: candidate.score - current.score,
      skills: {
        added: candidate.skills.filter(s => !current.skills.includes(s)),
        removed: current.skills.filter(s => !candidate.skills.includes(s)),
      },
    };
  }

  /* ---------------- 打书 ---------------- */
  const conflictPairs = (D.conflicts || []).map(p => p.slice(0, 2));
  function conflictsOf(skill) {
    const set = new Set();
    conflictPairs.forEach(([a, b]) => {
      if (a === skill) set.add(b);
      if (b === skill) set.add(a);
    });
    return [...set];
  }

  function bookSlots(pet) {
    return Number(pet.baseLevel) >= 125 ? 5 : 4;
  }

  function applyBook(pet, skill) {
    if (!pet) return { ok: false, desc: '请先选择召唤兽' };
    if (!skill) return { ok: false, desc: '请先选择兽决' };
    const skills = pet.skills.slice();
    if (skills.includes(skill)) {
      return { ok: true, type: 'exists', skills, desc: `${skill} 已在技能栏中，本次只消耗一本兽决。` };
    }
    const conflict = skills.find(s => conflictsOf(skill).includes(s));
    if (conflict) {
      const idx = skills.indexOf(conflict);
      skills[idx] = skill;
      return { ok: true, type: 'clash', skills, desc: `${skill} 顶掉了互斥技能「${conflict}」。` };
    }
    if (skills.length < bookSlots(pet) && skills.length < 12 && Math.random() < 0.25) {
      skills.push(skill);
      return { ok: true, type: 'open', skills, desc: `顶书开出了新的技能格，「${skill}」成功写入，当前 ${skills.length} 技能。` };
    }
    if (!skills.length) {
      skills.push(skill);
      return { ok: true, type: 'open', skills, desc: `空技能栏写入了「${skill}」。` };
    }
    if (skills.length >= 12) {
      const idx = randInt(0, skills.length - 1);
      const old = skills[idx];
      skills[idx] = skill;
      return { ok: true, type: 'replace', skills, desc: `技能栏已满，${skill} 顶掉了「${old}」。` };
    }
    const idx = randInt(0, skills.length - 1);
    const old = skills[idx];
    skills[idx] = skill;
    return { ok: true, type: 'replace', skills, desc: `${skill} 顶掉了「${old}」，当前 ${skills.length} 技能。` };
  }

  /* ---------------- 炼妖 ---------------- */
  const FAIL_PETS = ['大海龟', '泡泡', '野生召唤兽'];

  function fuse(main, sub) {
    if (!main || !sub) return { ok: false, note: '需要主宠与副宠各一只。' };
    const beastMain = getBeast(main.bid);
    const beastSub = getBeast(sub.bid);
    if (!beastMain || !beastSub) return { ok: false, note: '召唤兽数据缺失。' };

    const roll = Math.random();
    if (roll >= 0.9) {
      const failName = pick(FAIL_PETS);
      const failBeast = getBeast(failName) || beastMain;
      const failOpts = {
        variant: false,
        skills: failName === '野生召唤兽' ? [] : (failBeast.inn || []),
        origin: '炼妖失败',
      };
      if (failBeast === beastMain) failOpts.apt = rollApt(beastMain);
      const pet = buildPet(failBeast, failOpts);
      pet.name = failName === '野生召唤兽' ? '野生召唤兽' : failBeast.n;
      if (failName === '野生召唤兽') pet.skills = [];
      pet.score = scorePet(pet);
      return {
        ok: true, success: false, source: 'failure', pet,
        title: failName === '野生召唤兽' ? '炼妖失败 · 野生召唤兽' : `炼妖失败 · ${failBeast.n}`,
        note: '两只召唤兽消散，得到一只失败品，未能继承父母技能。',
      };
    }

    const source = roll < 0.45 ? 'main' : 'sub';
    const target = source === 'main' ? beastMain : beastSub;
    const parents = uniq(main.skills.concat(sub.skills));
    const inherited = parents.filter(() => Math.random() < 0.3);
    const innate = uniq(target.inn || []);
    const skills = [];
    innate.forEach(s => { if (!skills.includes(s) && skills.length < 12) skills.push(s); });
    inherited.forEach(s => {
      if (skills.length < 12 && !skills.includes(s) && !skills.some(x => conflictsOf(s).includes(x))) skills.push(s);
    });
    if (!skills.length && parents.length) skills.push(pick(parents));

    const apt = {};
    APT.forEach(k => {
      const avg = ((main.apt[k] || 0) + (sub.apt[k] || 0)) / 2;
      apt[k] = Math.max(800, Math.round(avg * randRange(0.7, 1.1)));
    });
    const growth = round3(((Number(main.growth) + Number(sub.growth)) / 2) * pick([0.96, 0.98, 1, 1.02]));
    const pet = buildPet(target, {
      variant: false,
      apt,
      growth,
      skills,
      origin: '炼妖',
    });
    return {
      ok: true, success: true, source, pet,
      title: source === 'main' ? `继承主宠 · ${target.n}` : `继承副宠 · ${target.n}`,
      note: `技能按每个 30% 概率继承，必带技能保留，成长取双亲均值并浮动。`,
    };
  }

  /* ---------------- 杂项 ---------------- */
  function formatNum(n) { return (Math.round(Number(n) || 0)).toLocaleString('zh-CN'); }

  function skillMeta(name) {
    const meta = D.skills[name] || { c: '特殊', t: /^高级/.test(name) ? 'high' : 'low' };
    return {
      name,
      category: meta.c,
      tier: meta.t,
      label: meta.t === 'special' ? '特殊' : meta.t === 'high' ? '高级' : '低级',
    };
  }

  function allBookSkills(petSkills) {
    return Object.keys(D.skills).map(name => {
      const meta = skillMeta(name);
      const clash = (petSkills || []).filter(s => conflictsOf(name).includes(s));
      return Object.assign(meta, {
        has: (petSkills || []).includes(name),
        clash,
      });
    }).sort((a, b) => {
      const order = { special: 0, high: 1, low: 2 };
      return order[a.tier] - order[b.tier] || a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  function randomBeastForWash() {
    const pool = beasts.filter(b => b.w);
    return pick(pool);
  }

  window.Engine = {
    D, APT, APT_NAME, ITEMS, beasts,
    getBeast,
    beastList: () => beasts,
    aptRanges,
    growthRange,
    rollApt,
    rollGrowth,
    rollSkills,
    buildPet,
    clonePet,
    scorePet,
    maxScoreOf,
    gradeOf,
    washItemFor,
    compare,
    bookSlots,
    applyBook,
    conflictsOf,
    allBookSkills,
    skillMeta,
    fuse,
    formatNum,
    randomBeastForWash,
    randInt,
    pick,
    uid,
    round3,
  };
})();
