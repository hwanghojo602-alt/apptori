(() => {
  "use strict";

  const CFG = Object.assign({ API_URL: "", SUBMIT_FORM_URL: "", CONTACT: "", RANK_MIN_APPS: 20 }, window.APPTORI_CONFIG || {});
  const CAT = { game: "게임", prod: "생산성" };
  const KIND = { web: "웹에서 바로", mobile: "휴대폰 앱", pc: "PC 설치" };
  const TRY = { web: "바로 써보기", mobile: "다운받기", pc: "다운받기" };
  const ID = /^[a-z0-9-]{2,40}$/;
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const HTTPS = /^https:\/\/[^\s"'<>`]+$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MOTIFS = ["tiles", "waves", "wheel", "question", "pixels", "receipt", "basket", "bars", "spark", "calendar", "formula"];
  const PALETTES = [["#4A1F2B", "#FF9E7A"], ["#12384A", "#7FD3E8"], ["#2E2A52", "#C9B8FF"], ["#234027", "#A8E06A"], ["#1F2E3D", "#9CC3F0"], ["#3D2440", "#F2A7C8"], ["#173A2C", "#6FE0A8"], ["#3B2A1E", "#F4B43A"]];
  const FORM_OK = HTTPS.test(CFG.SUBMIT_FORM_URL || "");

  const S = { status: "loading", sample: false, apps: [], q: "", cat: "all", kind: "all", rcat: "all", rmode: "hot", hero: 0 };
  const view = document.getElementById("view");

  /* ---------- 작은 도구 ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function hash(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h; }
  function seeded(str) { let h = hash(str) || 7; return () => (h = (h * 16807) % 2147483647) / 2147483647; }
  function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max); }
  function list(v) { const arr = Array.isArray(v) ? v : str(v, 2000).split(/\n+/); return arr.map(x => str(x, 140)).filter(Boolean).slice(0, 5); }
  function nonneg(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; }

  function deviceId() {
    try {
      let d = localStorage.getItem("apptori-device");
      if (!d || !/^[a-z0-9-]{8,40}$/.test(d)) {
        d = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).toLowerCase();
        localStorage.setItem("apptori-device", d);
      }
      return d;
    } catch (e) {
      if (!deviceId.temp) deviceId.temp = "t" + Math.random().toString(36).slice(2, 14);
      return deviceId.temp;
    }
  }
  function apiUrl(params) {
    const u = new URL(CFG.API_URL, location.href);
    Object.keys(params).forEach(k => u.searchParams.set(k, params[k]));
    return u.toString();
  }
  function track(type, id) {
    if (!CFG.API_URL || S.sample) return;
    try { fetch(apiUrl({ action: type, app: id, d: deviceId() }), { mode: "no-cors", keepalive: true, cache: "no-store" }).catch(() => {}); } catch (e) {}
  }

  /* ---------- 데이터 ---------- */
  function normalize(raw) {
    const out = [], seen = new Set();
    (Array.isArray(raw) ? raw : []).forEach(r => {
      if (!r || !ID.test(r.id) || seen.has(r.id) || !(r.cat in CAT) || !(r.kind in KIND)) return;
      const url = HTTPS.test(r.url || "") ? r.url : "";
      if (!url && !S.sample) return;
      const p = PALETTES[hash(r.id) % PALETTES.length];
      seen.add(r.id);
      out.push({
        id: r.id, cat: r.cat, kind: r.kind, url,
        name: str(r.name, 40) || r.id, genre: str(r.genre, 20), line: str(r.line, 80),
        hero: str(r.hero, 50) || str(r.line, 80), maker: str(r.maker, 30) || "이름 없는 메이커",
        makerLink: HTTPS.test(r.makerLink || "") ? r.makerLink : "", tool: str(r.tool, 30),
        date: DATE.test(r.date || "") ? r.date : "",
        poster: HTTPS.test(r.poster || "") ? r.poster : "", image: HTTPS.test(r.image || "") ? r.image : "",
        intent: str(r.intent, 800), target: str(r.target, 300), features: list(r.features), steps: list(r.steps),
        featured: r.featured === true, isNew: r.isNew === true,
        tries: nonneg(r.tries), shares: nonneg(r.shares), last: r.last == null ? null : nonneg(r.last),
        bg: HEX.test(r.bg || "") ? r.bg : p[0], fg: HEX.test(r.fg || "") ? r.fg : p[1],
        motif: MOTIFS.includes(r.motif) ? r.motif : MOTIFS[hash(r.id) % MOTIFS.length]
      });
    });
    return out;
  }

  async function load() {
    S.status = "loading"; render();
    try {
      let data;
      if (!CFG.API_URL) {
        data = window.APPTORI_SAMPLE; S.sample = true;
      } else {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
        const res = await fetch(apiUrl({ action: "apps" }), { cache: "no-store", signal: ctl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error("http " + res.status);
        data = await res.json();
      }
      if (!data || data.ok === false) throw new Error("bad data");
      S.apps = normalize(data.apps);
      S.status = "ready";
    } catch (e) {
      S.status = "error";
    }
    document.getElementById("sample-notice").hidden = !S.sample;
    render();
  }

  /* ---------- 그림 ---------- */
  function art(a, alt) {
    const bg = alt ? a.fg : a.bg, fg = alt ? a.bg : a.fg, r = seeded(a.id + (alt ? "x" : ""));
    let s = "";
    switch (a.motif) {
      case "tiles": { const n = ["2", "4", "", "8", "", "16", "2", "", "32", "", "4", "", "", "64", "", "2"];
        n.forEach((t, i) => { const x = 81 + (i % 4) * 41, y = 12 + Math.floor(i / 4) * 41;
          s += `<rect x="${x}" y="${y}" width="34" height="34" rx="7" fill="${fg}" opacity="${t ? 1 : 0.16}"/>`;
          if (t) s += `<text x="${x + 17}" y="${y + 23}" text-anchor="middle" font-size="14" font-weight="700" fill="${bg}" font-family="IBM Plex Sans KR, sans-serif">${t}</text>`; }); break; }
      case "waves": for (let i = 0; i < 5; i++) { const y = 40 + i * 28; s += `<path d="M-10 ${y} Q 30 ${y - 14} 70 ${y} T 150 ${y} T 230 ${y} T 310 ${y} T 390 ${y}" fill="none" stroke="${fg}" stroke-width="5" stroke-linecap="round" opacity="${0.25 + i * 0.15}"/>`; }
        s += `<ellipse cx="200" cy="96" rx="22" ry="11" fill="${fg}"/><path d="M178 96 l-14 -10 v20z" fill="${fg}"/><circle cx="210" cy="93" r="2.5" fill="${bg}"/>`; break;
      case "wheel": s += `<circle cx="160" cy="92" r="68" fill="none" stroke="${fg}" stroke-width="9"/><circle cx="160" cy="92" r="10" fill="${fg}"/>`;
        for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; s += `<line x1="160" y1="92" x2="${160 + Math.cos(t) * 64}" y2="${92 + Math.sin(t) * 64}" stroke="${fg}" stroke-width="3" opacity="0.5"/>`; }
        s += `<ellipse cx="160" cy="150" rx="18" ry="13" fill="${fg}"/><circle cx="150" cy="140" r="6" fill="${fg}"/>`; break;
      case "question": for (let i = 0; i < 18; i++) { const x = 18 + (i % 6) * 56, y = 40 + Math.floor(i / 6) * 56; s += `<text x="${x}" y="${y}" font-size="26" fill="${fg}" opacity="${0.12 + r() * 0.25}" font-family="Jua, sans-serif">?</text>`; }
        s += `<circle cx="160" cy="90" r="48" fill="${fg}"/><text x="160" y="112" text-anchor="middle" font-size="64" fill="${bg}" font-family="Jua, sans-serif">?</text>`; break;
      case "pixels": for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) { const v = r(); if (v > 0.55) s += `<rect x="${x * 16}" y="${y * 16}" width="16" height="16" fill="${fg}" opacity="${v > 0.85 ? 1 : 0.35}"/>`; } break;
      case "receipt": s += `<g transform="rotate(-6 160 90)"><rect x="104" y="18" width="112" height="150" rx="6" fill="${fg}"/>`;
        for (let i = 0; i < 6; i++) s += `<rect x="118" y="${40 + i * 18}" width="${50 + r() * 34}" height="6" rx="3" fill="${bg}"/>`;
        s += `<rect x="118" y="150" width="84" height="8" rx="4" fill="${bg}"/></g>`; break;
      case "basket": for (let i = 0; i < 22; i++) s += `<circle cx="${20 + r() * 280}" cy="${20 + r() * 140}" r="${6 + r() * 16}" fill="${fg}" opacity="${0.25 + r() * 0.6}"/>`; break;
      case "bars": [210, 170, 128].forEach((w, i) => { s += `<circle cx="58" cy="${54 + i * 36}" r="9" fill="none" stroke="${fg}" stroke-width="3"/><rect x="80" y="${47 + i * 36}" width="${w}" height="14" rx="7" fill="${fg}" opacity="${1 - i * 0.2}"/>`; }); break;
      case "spark": for (let i = 0; i < 9; i++) { const x = 30 + r() * 260, y = 24 + r() * 130, k = 6 + r() * 16;
        s += `<path d="M${x} ${y - k} Q${x} ${y} ${x + k} ${y} Q${x} ${y} ${x} ${y + k} Q${x} ${y} ${x - k} ${y} Q${x} ${y} ${x} ${y - k}Z" fill="${fg}" opacity="${0.4 + r() * 0.6}"/>`; } break;
      case "calendar": for (let i = 0; i < 28; i++) { const x = 48 + (i % 7) * 33, y = 26 + Math.floor(i / 7) * 33, on = [3, 9, 10, 18, 24].includes(i);
        s += `<rect x="${x}" y="${y}" width="27" height="27" rx="5" fill="${on ? fg : "none"}" stroke="${fg}" stroke-width="1.5" opacity="${on ? 1 : 0.45}"/>`; } break;
      case "formula": for (let i = 1; i < 6; i++) s += `<line x1="0" y1="${i * 30}" x2="320" y2="${i * 30}" stroke="${fg}" opacity="0.15"/>`;
        for (let i = 1; i < 8; i++) s += `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="180" stroke="${fg}" opacity="0.15"/>`;
        s += `<text x="160" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="${fg}" font-family="ui-monospace, Consolas, monospace">=SUM( )</text>`; break;
    }
    return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="180" fill="${bg}"/>${s}</svg>`;
  }
  // shape: "tall"(3:4 포스터) | "wide"(가로)
  function media(a, shape) {
    const src = shape === "tall" ? (a.poster || a.image) : (a.image || a.poster);
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : art(a);
  }

  /* ---------- 순위 ---------- */
  function showRank() { return S.sample || S.apps.length >= CFG.RANK_MIN_APPS; }
  function ranking(cat, mode) {
    const pool = S.apps.filter(a => cat === "all" || a.cat === cat);
    const now = [...pool].sort((x, y) => y.tries - x.tries || x.name.localeCompare(y.name, "ko"));
    const prev = pool.filter(a => a.last != null).sort((x, y) => y.last - x.last || x.name.localeCompare(y.name, "ko"));
    const rows = now.map((a, i) => { const p = prev.indexOf(a); return { a, rank: i + 1, delta: p < 0 ? null : p + 1 - (i + 1) }; });
    if (mode === "rise") rows.sort((x, y) => {
      const g = r => r.delta == null ? 1 : r.delta > 0 ? 0 : 2;
      return g(x) - g(y) || (g(x) === 0 ? y.delta - x.delta : 0) || x.rank - y.rank;
    });
    return rows;
  }
  function move(d) {
    if (d == null) return `<span class="move new">NEW</span>`;
    if (d > 0) return `<span class="move up" aria-label="${d}계단 올라감">▲${d}</span>`;
    if (d < 0) return `<span class="move down" aria-label="${-d}계단 내려감">▼${-d}</span>`;
    return `<span class="move same" aria-label="변동 없음">–</span>`;
  }

  /* ---------- 조각 ---------- */
  function chips(group, opts, cur) { return `<div class="chips" role="group">${opts.map(([k, l]) => `<button type="button" class="chip" data-${group}="${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</div>`; }
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return S.apps.filter(a => (S.cat === "all" || a.cat === S.cat) && (S.kind === "all" || a.kind === S.kind) &&
      (!q || [a.name, a.line, a.genre, a.maker, CAT[a.cat], a.target].join(" ").toLowerCase().includes(q)));
  }
  const card = a => `<a class="card" href="#app-${a.id}"><span class="art">${media(a, "tall")}${a.isNew ? '<span class="badge">신규</span>' : ""}</span>
    <h3>${esc(a.name)}</h3><span class="genre">${esc(a.genre ? a.genre + " · " : "")}${KIND[a.kind]}</span></a>`;
  function results() {
    const l = filtered();
    return l.length ? l.map(card).join("") : `<div class="empty"><b>찾는 앱이 아직 없어요</b><p>다른 말로 찾아보거나, 조건을 풀어 보세요.</p><button class="btn" type="button" data-reset>조건 모두 풀기</button></div>`;
  }
  function tryButton(a, extraClass) {
    if (a.url) return `<a class="btn primary ${extraClass || ""}" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" data-track="try" data-app="${a.id}">${TRY[a.kind]}</a>`;
    return `<button class="btn primary ${extraClass || ""}" type="button" data-sample-try>${TRY[a.kind]}</button>`;
  }
  function uploadAttrs() { return FORM_OK ? `href="${esc(CFG.SUBMIT_FORM_URL)}" target="_blank" rel="noopener noreferrer"` : `href="#" data-upload`; }

  function rankBlock() {
    if (!showRank()) {
      const n = S.apps.length, pct = Math.min(100, Math.round(n / CFG.RANK_MIN_APPS * 100));
      return `<div class="locked"><b>순위는 진열된 앱이 ${CFG.RANK_MIN_APPS}개가 되면 열려요</b><p class="num">지금 ${n}개 진열 중이에요. 써본 사람 수는 지금부터 세고 있어요.</p><div class="meter" role="img" aria-label="${pct}% 채워짐"><span style="width:${pct}%"></span></div></div>`;
    }
    const rows = ranking(S.rcat, S.rmode), top = rows.slice(0, 5), rest = rows.slice(5, 10);
    if (!rows.length) return `<div class="empty"><b>이 분류에는 아직 앱이 없어요</b></div>`;
    const no = (r, i) => S.rmode === "rise" ? i + 1 : r.rank;
    return `<div class="top5">${top.map((r, i) => `<a class="top-item${i === 0 ? " first" : ""}" href="#app-${r.a.id}">
        <span class="big-n" aria-hidden="true">${no(r, i)}</span><span class="art">${media(r.a, "tall")}</span>
        <span class="meta"><h3>${esc(r.a.name)}</h3><span>${move(r.delta)} <span class="tries num">· ${r.a.tries.toLocaleString()}명이 써봤어요</span></span></span></a>`).join("")}</div>
      ${rest.length ? `<div class="rest">${rest.map((r, i) => `<a href="#app-${r.a.id}"><span class="n num">${no(r, i + 5)}</span><span class="art">${media(r.a, "tall")}</span>
        <span><b>${esc(r.a.name)}</b><small>${esc(r.a.genre ? r.a.genre + " · " : "")}${CAT[r.a.cat]}</small></span><span class="side">${move(r.delta)}<small class="num">${r.a.tries.toLocaleString()}명</small></span></a>`).join("")}</div>` : ""}`;
  }

  /* ---------- 화면 ---------- */
  function loadingView() {
    view.innerHTML = `<div class="skel" style="aspect-ratio:21/8;border-radius:20px"></div>
      <p class="loading-note">진열대를 정리하는 중이에요…</p>
      <section class="sec"><div class="grid">${"<div class='skel' style='aspect-ratio:3/4'></div>".repeat(5)}</div></section>`;
  }
  function errorView() {
    view.innerHTML = `<div class="empty"><b>진열대를 불러오지 못했어요</b><p>인터넷 연결을 확인하고 다시 시도해 주세요. 계속 안 되면 잠시 뒤에 다시 와 주세요.</p><button class="btn primary" type="button" data-retry>다시 시도</button></div>`;
  }

  function home() {
    if (!S.apps.length) {
      view.innerHTML = `<section class="band" style="margin-top:8px"><div><h2>진열대를 채우는 중이에요</h2><p>곧 AI로 만든 앱들이 이곳에 진열돼요. 직접 만든 앱이 있다면 첫 번째로 올려 보세요.</p></div><a class="btn primary" ${uploadAttrs()}>내 앱 올리기</a></section>`;
      return;
    }
    let feat = S.apps.filter(a => a.featured);
    if (!feat.length) feat = [...S.apps].sort((x, y) => y.tries - x.tries).slice(0, 3);
    const f = feat[S.hero % feat.length];
    view.innerHTML = `<section class="hero"><span class="art">${media(f, "wide")}</span><span class="scrim"></span>
        <div class="copy"><p class="kicker">이번 주 토리 픽 · ${CAT[f.cat]} · ${esc(f.name)}</p><h1>${esc(f.hero)}</h1>
          <div class="actions" style="justify-content:center;margin:0">${tryButton(f)}<a class="btn light" href="#app-${f.id}">자세히 보기</a></div></div></section>
      ${feat.length > 1 ? `<div class="dots">${feat.map((x, i) => `<button type="button" data-hero="${i}" aria-label="${esc(x.name)}" aria-pressed="${i === S.hero % feat.length}"></button>`).join("")}</div>` : ""}

      <section class="sec" aria-labelledby="rank-title"><div class="sec-head"><h2 id="rank-title">이번 주 순위</h2>
          ${showRank() ? `<div class="chips">${chips("rmode", [["hot", "인기"], ["rise", "급상승"]], S.rmode)}<span style="width:8px"></span>${chips("rcat", [["all", "종합"], ["game", "게임"], ["prod", "생산성"]], S.rcat)}</div>` : ""}</div>
        <p class="rank-basis">이번 주 써보기를 누른 사람 수로 정해요. 한 사람은 앱마다 하루 한 번만 세요. <a href="#rules" data-rules style="text-decoration:underline">순위 기준</a></p>
        <div id="rank">${rankBlock()}</div></section>

      <section class="sec"><div class="sec-head"><h2>모든 앱</h2>${chips("cat", [["all", "전체"], ["game", "게임"], ["prod", "생산성"]], S.cat)}</div>
        <div class="filters">${chips("kind", [["all", "모든 종류"], ["web", "웹에서 바로"], ["mobile", "휴대폰 앱"], ["pc", "PC 설치"]], S.kind)}<span class="count num" id="count">${filtered().length}개</span></div>
        <div class="grid" id="results">${results()}</div></section>

      <section class="band"><div><h2>내가 만든 앱도 순위에 올려보세요</h2><p>이름, 링크, 제작 의도만 적으면 확인 후 진열해 드려요. 공유 링크로 들어와 써본 사람도 이번 주 순위에 들어가요.</p></div><a class="btn primary" ${uploadAttrs()}>내 앱 올리기</a></section>`;
  }

  function refresh() {
    const box = document.getElementById("results"); if (!box) { location.hash = ""; return; }
    box.innerHTML = results();
    document.getElementById("count").textContent = `${filtered().length}개`;
    document.getElementById("rank").innerHTML = rankBlock();
    ["cat", "kind", "rcat", "rmode"].forEach(g => document.querySelectorAll(`[data-${g}]`).forEach(b => b.setAttribute("aria-pressed", String(b.dataset[g] === S[g]))));
  }

  function detail(id) {
    const a = S.apps.find(x => x.id === id);
    if (!a) { view.innerHTML = `<a class="back" href="#">진열장으로</a><div class="empty"><b>이 앱을 찾을 수 없어요</b><p>주소가 바뀌었거나 진열에서 내려간 앱이에요.</p><a class="btn" href="#">진열장 둘러보기</a></div>`; return; }
    document.title = `${a.name} · 앱토리`;
    const r = ranking(a.cat, "hot").find(x => x.a === a);
    const same = S.apps.filter(x => x.cat === a.cat && x.id !== a.id).slice(0, 5);
    const sec = (h, body) => body ? `<div><h2>${h}</h2>${body}</div>` : "";
    view.innerHTML = `<a class="back" href="#">진열장으로</a><div class="detail">
      <aside class="side-col">
        <div class="panel maker"><span class="avatar">${esc(a.maker.slice(0, 1))}</span><b>${esc(a.maker)}</b>${a.makerLink ? `<a href="${esc(a.makerLink)}" target="_blank" rel="noopener noreferrer nofollow">만든 사람 보러 가기</a>` : ""}</div>
        ${showRank() ? `<div class="panel rank-card"><span class="label">이번 주 ${CAT[a.cat]} 순위</span><span class="pos num">${r.rank}위 ${move(r.delta)}</span><span class="label num">${a.tries.toLocaleString()}명이 써봤어요</span></div>` : ""}
        <div class="panel stats"><div><b class="num">${a.tries.toLocaleString()}</b><span>이번 주 써봄</span></div><div><b class="num">${a.shares.toLocaleString()}</b><span>이번 주 공유</span></div></div>
      </aside>
      <article class="main-col"><p class="eyebrow">${CAT[a.cat]}${a.genre ? " · " + esc(a.genre) : ""}</p><h1>${esc(a.name)}</h1><p class="lead">${esc(a.line)}</p>
        <div class="actions">${tryButton(a)}<button class="btn" type="button" data-share="${a.id}">공유하기</button></div>
        <span class="art">${media(a, "wide")}</span>
        <div class="story">
          ${sec("제작 의도", a.intent && `<p>${esc(a.intent)}</p>`)}
          ${sec("이런 분께", a.target && `<p>${esc(a.target)}</p>`)}
          ${sec("특징", a.features.length && `<ul>${a.features.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`)}
          ${sec("사용 방법", a.steps.length && `<ol>${a.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>`)}
        </div>
        <dl class="credits"><dt>분류</dt><dd>${CAT[a.cat]}${a.genre ? " · " + esc(a.genre) : ""}</dd><dt>종류</dt><dd>${KIND[a.kind]}</dd><dt>만든 사람</dt><dd>${esc(a.maker)}</dd>${a.tool ? `<dt>만든 도구</dt><dd>${esc(a.tool)}</dd>` : ""}${a.date ? `<dt>진열일</dt><dd class="num">${a.date.replaceAll("-", ".")}</dd>` : ""}</dl>
        <p class="later">${a.kind === "web" ? "써보기를 누르면 만든 사람의 사이트가 새 창으로 열려요." : "앱토리는 파일을 보관하지 않아요. 만든 사람의 공식 주소로 연결돼요."} 쓸모·완성도·설명 평가는 로그인 기능이 생기면 열려요.</p>
        <div class="boost"><div><h2>이 앱을 응원하는 방법</h2><p>링크를 친구나 SNS에 공유해 주세요. 그 링크로 들어와 써본 사람도 이번 주 순위에 들어가요.</p></div><button class="btn primary" type="button" data-share="${a.id}">링크 복사</button></div>
      </article></div>
      ${same.length ? `<section class="sec"><div class="sec-head"><h2>같은 분류의 다른 앱</h2></div><div class="grid">${same.map(card).join("")}</div></section>` : ""}`;
  }

  function render() {
    document.title = "앱토리";
    if (S.status === "loading") return loadingView();
    if (S.status === "error") return errorView();
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith("app-")) detail(h.slice(4)); else home();
  }

  /* ---------- 알림 ---------- */
  const toastEl = document.getElementById("toast"); let toastTimer;
  function toast(m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.hidden = true), 3400); }

  function copyLink(url) {
    const fallback = () => toast("이 링크를 복사해 주세요: " + url);
    try { navigator.clipboard.writeText(url).then(() => toast("링크를 복사했어요. 이 링크로 들어와 써본 사람도 순위에 들어가요."), fallback); } catch (e) { fallback(); }
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    for (const g of ["cat", "kind", "rcat", "rmode"]) if (t.dataset[g]) { S[g] = t.dataset[g]; refresh(); return; }
    if (t.dataset.hero) { S.hero = Number(t.dataset.hero); home(); return; }
    if ("reset" in t.dataset) { S.q = ""; S.cat = "all"; S.kind = "all"; document.getElementById("q").value = ""; refresh(); return; }
    if ("retry" in t.dataset) { load(); return; }
    if ("rules" in t.dataset) { e.preventDefault(); const d = document.getElementById("rules"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (t.dataset.track === "try") { track("try", t.dataset.app); return; }
    if ("sampleTry" in t.dataset) { toast("예시 앱이라 연결된 주소가 없어요. 실제 앱은 새 창으로 열려요."); return; }
    if (t.dataset.share) { const id = t.dataset.share; copyLink(location.origin + location.pathname + "#app-" + id); track("share", id); return; }
    if ("upload" in t.dataset) { e.preventDefault(); toast("앱 등록 신청서를 준비 중이에요. 조금만 기다려 주세요."); }
  });
  document.getElementById("q").addEventListener("input", e => {
    S.q = e.target.value;
    if (S.status !== "ready") return;
    if (location.hash.startsWith("#app-")) { location.hash = ""; return; }
    refresh();
  });
  document.addEventListener("error", e => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.closest(".art")) img.remove();
  }, true);
  window.addEventListener("hashchange", () => { if (S.status === "ready") { render(); window.scrollTo(0, 0); } });

  document.getElementById("upload-top").outerHTML = `<a class="up-btn" id="upload-top" ${uploadAttrs()}>내 앱 올리기</a>`;
  if (CFG.CONTACT) document.getElementById("contact").textContent = "문의 " + str(CFG.CONTACT, 80);
  load();
})();
