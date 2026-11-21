/* =========================================================
   Bac Tunisie — Interactions (Section Picker, Search, TOC, Progress, Theme)
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SECTIONS = window.BAC_SECTIONS || [];
  const ROOT = document.body.dataset.root || "";
  const SEC_ID = document.body.dataset.section || null;
  const SUBJ_ID = document.body.dataset.subject || null;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const doneKey = id => "bac-done-" + id;
  const subjUrl = s => ROOT + "matieres/" + s.file;
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------- Theme (light default) ---------- */
  const applyTheme = t => {
    document.documentElement.dataset.theme = t;
    $$("[data-theme-toggle]").forEach(b => (b.textContent = t === "dark" ? "☀️" : "🌙"));
  };
  applyTheme(store.get("bac-theme", "light"));
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    store.set("bac-theme", t); applyTheme(t);
  });

  /* ---------- Progress & scroll ---------- */
  const toTop = $(".to-top");
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const bar = $(".progress-bar");
  const onScroll = () => {
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
    if (toTop) toTop.classList.toggle("show", h.scrollTop > 500);
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Dropdown ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-dropdown-toggle]");
    $$(".dropdown").forEach(d => { if (!t || d !== t.closest(".dropdown")) d.classList.remove("open"); });
    if (t) t.closest(".dropdown").classList.toggle("open");
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { $$(".dropdown").forEach(d => d.classList.remove("open")); document.body.classList.remove("toc-open"); }
  });

  /* ---------- Code blocks (Prism + Algo pseudo-code) ---------- */
  const W = alts => new RegExp("(?<![\\p{L}\\d_])(?:" + alts + ")(?![\\p{L}\\d_])", "gu");
  const ALGO_KW = W("Début|Fin Si|Fin Pour|Fin Tant Que|Fin Selon|Fin|Sinon Si|Sinon|Si|Alors|Pour|de|à|Faire|Tant Que|Répéter|Jusqu'à|Retourner|Fonction|Procédure|Algorithme|Selon|Pas|Enregistrement|Tableau|Type");
  const ALGO_TY = W("Entier|Réel|Caractère|Booléen|Chaîne|Fichier|Texte|Vrai|Faux");
  const ALGO_OP = new RegExp("(?<![\\p{L}\\d_])(?:Div|Mod|et|ou|Non)(?![\\p{L}\\d_])|←|≠|≤|≥", "gu");
  function highlightAlgo(code) {
    const lines = code.textContent.split("\n").map(line => {
      let cm = "";
      const ci = line.indexOf("//");
      if (ci >= 0) { cm = line.slice(ci); line = line.slice(0, ci); }
      const parts = line.split(/("[^"]*")/g).map((p, i) => {
        if (i % 2) return `<span class="algo-st">${esc(p)}</span>`;
        let h = esc(p);
        h = h.replace(/\b(\d+(?:[.,]\d+)?)\b/g, '<span class="algo-nb">$1</span>');
        h = h.replace(ALGO_KW, '<span class="algo-kw">$&</span>');
        h = h.replace(ALGO_TY, '<span class="algo-ty">$&</span>');
        h = h.replace(ALGO_OP, '<span class="algo-op">$&</span>');
        return h;
      });
      return parts.join("") + (cm ? `<span class="algo-cm">${esc(cm)}</span>` : "");
    });
    code.innerHTML = lines.join("\n");
  }
  const LANG_NAMES = { algo: "Algorithme", python: "Python", sql: "SQL", markup: "HTML", html: "HTML", css: "CSS", javascript: "JavaScript", js: "JavaScript", php: "PHP", text: "Code" };
  $$("pre > code").forEach(code => {
    const pre = code.parentElement;
    if (pre.parentElement.classList.contains("code-block")) return;
    const m = (code.className.match(/language-([\w-]+)/) || [])[1] || "text";
    if (m === "html") code.className = code.className.replace("language-html", "language-markup");
    if (m === "algo") { highlightAlgo(code); code.className = code.className.replace("language-algo", "algo-code"); }
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    const title = pre.dataset.title ? " — " + pre.dataset.title : "";
    wrap.innerHTML = `<div class="code-head"><span class="dots"><i></i><i></i><i></i></span><span class="lang">${LANG_NAMES[m] || m}${title}</span><button class="copy-btn" type="button">Copier</button></div>`;
    pre.replaceWith(wrap); wrap.appendChild(pre);
    wrap.querySelector(".copy-btn").addEventListener("click", ev => {
      const btn = ev.currentTarget;
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = "✓ Copié"; btn.classList.add("ok");
        setTimeout(() => { btn.textContent = "Copier"; btn.classList.remove("ok"); }, 1500);
      });
    });
  });
  if (window.Prism) window.Prism.highlightAll();

  /* =========================================================
     SUBJECT PAGE
     ========================================================= */
  if (SEC_ID && SUBJ_ID) {
    const sec = SECTIONS.find(s => s.id === SEC_ID);
    const subj = sec && sec.subjects.find(x => x.id === SUBJ_ID);
    const rtl = document.documentElement.dir === "rtl";
    const T = rtl
      ? { toc: "فهرس المحتويات", done: "راجعتُ هذا المحور", isDone: "تمّت المراجعة ✓", prog: "تقدّم المراجعة", print: "🖨️ طباعة", reset: "↺ إعادة", prev: "السابق", next: "التالي", min: "دقيقة قراءة", ch: "محاور" }
      : { toc: "Sommaire", done: "J'ai révisé ce chapitre", isDone: "Chapitre révisé ✓", prog: "Progression", print: "🖨️ Imprimer", reset: "↺ Réinitialiser", prev: "Précédent", next: "Suivant", min: "min de lecture", ch: "chapitres" };

    // Dropdown menu: subjects of the current section
    if (sec) {
      $$("[data-subjects-menu]").forEach(menu => {
        menu.innerHTML = sec.subjects.map(s => `<a href="${subjUrl(s)}"><span>${s.icon}</span><span>${s.title}</span></a>`).join("");
      });
    }

    const chapters = $$(".chapter");
    let done = store.get(doneKey(SUBJ_ID), []);
    chapters.forEach(ch => $$("h3", ch).forEach((h, i) => { if (!h.id) h.id = ch.id + "-" + (i + 1); }));
    chapters.forEach((ch, i) => {
      const h2 = $("h2", ch);
      if (h2 && !$(".num", h2)) h2.insertAdjacentHTML("afterbegin", `<span class="num">${i + 1}</span>`);
    });

    // TOC (built before KaTeX runs so math renders cleanly inside TOC too)
    const toc = $(".toc");
    if (toc) {
      let html = `<div class="toc-card"><h4>${T.toc}</h4><ol>`;
      chapters.forEach((ch, i) => {
        const h2 = $("h2", ch);
        const clone = h2 ? h2.cloneNode(true) : null;
        if (clone) { const n = $(".num", clone); if (n) n.remove(); }
        const label = clone ? clone.innerHTML.trim() : ch.id;
        html += `<li><a href="#${ch.id}" data-id="${ch.id}"><span class="n">${i + 1}</span><span>${label}</span><span class="done-mark"></span></a>`;
        const h3s = $$("h3", ch);
        if (h3s.length) html += `<ol class="sub">` + h3s.map(h => `<li><a href="#${h.id}" data-id="${h.id}"><span>${h.innerHTML}</span></a></li>`).join("") + `</ol>`;
        html += `</li>`;
      });
      html += `</ol><div class="toc-progress"><div style="display:flex;justify-content:space-between"><span>${T.prog}</span><b data-prog-txt>0%</b></div><div class="mini-progress"><span data-prog-bar></span></div></div>
        <div class="toc-tools"><button class="btn" type="button" data-print>${T.print}</button><button class="btn" type="button" data-reset>${T.reset}</button></div></div>`;
      toc.innerHTML = html;
      toc.addEventListener("click", e => { if (e.target.closest("a")) document.body.classList.remove("toc-open"); });
    }

    const refresh = () => {
      chapters.forEach(ch => {
        const isD = done.includes(ch.id);
        const b = $(".chapter-done", ch);
        if (b) { b.classList.toggle("is-done", isD); b.querySelector(".lbl").textContent = isD ? T.isDone : T.done; b.querySelector(".box").textContent = isD ? "✓" : ""; }
        const mk = toc && $(`a[data-id="${ch.id}"] .done-mark`, toc);
        if (mk) mk.textContent = isD ? "✓" : "";
      });
      const pct = chapters.length ? Math.round((done.filter(id => chapters.some(c => c.id === id)).length / chapters.length) * 100) : 0;
      $$("[data-prog-txt]").forEach(e => (e.textContent = pct + "%"));
      $$("[data-prog-bar]").forEach(e => (e.style.width = pct + "%"));
    };
    chapters.forEach(ch => {
      ch.insertAdjacentHTML("beforeend", `<button class="chapter-done" type="button"><span class="box"></span><span class="lbl"></span></button>`);
      $(".chapter-done", ch).addEventListener("click", () => {
        done = done.includes(ch.id) ? done.filter(x => x !== ch.id) : done.concat(ch.id);
        store.set(doneKey(SUBJ_ID), done); refresh();
      });
    });
    refresh();
    document.addEventListener("click", e => {
      if (e.target.closest("[data-print]")) window.print();
      if (e.target.closest("[data-reset]")) { done = []; store.set(doneKey(SUBJ_ID), done); refresh(); }
    });

    // Scrollspy
    const links = toc ? $$("a[data-id]", toc) : [];
    const targets = links.map(a => document.getElementById(a.dataset.id)).filter(Boolean);
    const spy = () => {
      const y = window.scrollY + 130;
      let cur = targets[0];
      targets.forEach(t => { if (t.getBoundingClientRect().top + window.scrollY <= y) cur = t; });
      links.forEach(a => a.classList.toggle("active", cur && a.dataset.id === cur.id));
    };
    window.addEventListener("scroll", spy, { passive: true }); spy();

    // Read time & chapters count
    const words = ($(".content") || document.body).textContent.trim().split(/\s+/).length;
    $$("[data-readtime]").forEach(e => (e.textContent = `⏱ ${Math.max(2, Math.round(words / 180))} ${T.min}`));
    $$("[data-chapcount]").forEach(e => (e.textContent = `📑 ${chapters.length} ${T.ch}`));

    const fab = $(".toc-fab");
    if (fab) fab.addEventListener("click", () => document.body.classList.toggle("toc-open"));

    // Prev / Next within same section
    const pager = $(".pager");
    if (pager && sec && subj) {
      const i = sec.subjects.indexOf(subj);
      const prev = sec.subjects[(i - 1 + sec.subjects.length) % sec.subjects.length];
      const next = sec.subjects[(i + 1) % sec.subjects.length];
      pager.innerHTML = `<a class="prev" href="${subjUrl(prev)}"><small>← ${T.prev}</small>${prev.icon} ${prev.title}</a><a class="next" href="${subjUrl(next)}"><small>${T.next} →</small>${next.icon} ${next.title}</a>`;
    }
  }

  /* =========================================================
     HOME PAGE (SECTION PICKER + SECTION DASHBOARD)
     ========================================================= */
  const pickerView = $("#picker-view");
  const sectionView = $("#section-view");
  if (pickerView && sectionView) {
    const cardsBox = $("[data-section-cards]");
    const grid = $("[data-subject-grid]");
    const sInput = $("[data-search]");
    const btnChange = $("#btn-change-sec");

    const progressOfSubj = s => {
      const d = store.get(doneKey(s.id), []);
      if (!s.chapters.length) return 0;
      return Math.round((d.filter(id => s.chapters.some(c => c[0] === id)).length / s.chapters.length) * 100);
    };
    const progressOfSec = sec => {
      const total = sec.subjects.reduce((a, s) => a + s.chapters.length, 0);
      if (!total) return 0;
      const done = sec.subjects.reduce((a, s) => a + store.get(doneKey(s.id), []).filter(id => s.chapters.some(c => c[0] === id)).length, 0);
      return Math.round((done / total) * 100);
    };

    // Render 6 section picker cards
    cardsBox.innerHTML = SECTIONS.map(sec => `
      <button class="sec-card" type="button" style="--c:${sec.color}" data-pick-sec="${sec.id}">
        <span class="sec-ico">${sec.icon}</span>
        <span>
          <h3>${sec.name}</h3>
          <p>${sec.desc}</p>
          <span class="sec-meta"><span>${sec.subjects.length} résumés</span> · <span>Ouvrir →</span></span>
        </span>
      </button>
    `).join("");

    let currentSec = null;

    const renderSubjects = (sec, query = "") => {
      const q = norm(query.trim());
      const list = sec.subjects.filter(s => {
        if (!q) return true;
        const hay = norm(s.title + " " + s.desc + " " + s.chapters.map(c => c[1]).join(" "));
        return q.split(/\s+/).every(t => hay.includes(t));
      });
      if (!list.length) {
        grid.innerHTML = `<p style="color:var(--muted);grid-column:1/-1">Aucun résumé trouvé pour « ${esc(query)} ».</p>`;
        return;
      }
      grid.innerHTML = list.map(s => {
        const p = progressOfSubj(s);
        return `<a class="subject-card" href="${subjUrl(s)}" style="--c:${s.color}">
          <div class="card-top">
            <span class="card-ico">${s.icon}</span>
            <span class="badge">${s.chapters.length} chapitres</span>
          </div>
          <h3${s.rtl ? ' dir="rtl"' : ""}>${s.title}</h3>
          <p${s.rtl ? ' dir="rtl"' : ""}>${s.desc}</p>
          <div class="meta"><span>${p === 100 ? "✅ Terminé" : p > 0 ? "En cours" : "Ouvrir"}</span><span>${p}%</span></div>
          <div class="mini-progress"><span style="width:${p}%"></span></div>
        </a>`;
      }).join("");
    };

    const showPicker = () => {
      currentSec = null;
      pickerView.style.display = "";
      sectionView.style.display = "none";
      if (btnChange) btnChange.style.display = "none";
      document.body.style.removeProperty("--accent");
      if (location.hash) history.replaceState(null, "", location.pathname);
      window.scrollTo({ top: 0 });
    };

    const showSection = secId => {
      const sec = SECTIONS.find(s => s.id === secId);
      if (!sec) { showPicker(); return; }
      currentSec = sec;
      store.set("bac-last-section", sec.id);
      if (location.hash !== "#" + sec.id) history.replaceState(null, "", "#" + sec.id);
      document.body.style.setProperty("--accent", sec.color);
      pickerView.style.display = "none";
      sectionView.style.display = "";
      if (btnChange) btnChange.style.display = "";

      $("[data-sec-ico]").textContent = sec.icon;
      $("[data-sec-name]").textContent = sec.name;
      $("[data-sec-desc]").textContent = `${sec.subjects.length} résumés complets · ${sec.desc}`;
      const sp = progressOfSec(sec);
      $("[data-sec-prog-txt]").textContent = `${sp}% révisé`;
      $("[data-sec-prog-bar]").style.width = sp + "%";

      $("[data-sec-switcher]").innerHTML = SECTIONS.map(s =>
        `<button class="sec-tab${s.id === sec.id ? " active" : ""}" type="button" data-pick-sec="${s.id}">${s.icon} ${s.short}</button>`
      ).join("");

      if (sInput) sInput.value = "";
      renderSubjects(sec, "");
      window.scrollTo({ top: 0 });
    };

    document.addEventListener("click", e => {
      const pick = e.target.closest("[data-pick-sec]");
      if (pick) { showSection(pick.dataset.pickSec); return; }
      if (e.target.closest("[data-go-picker]")) { e.preventDefault(); showPicker(); }
    });
    if (sInput) sInput.addEventListener("input", () => { if (currentSec) renderSubjects(currentSec, sInput.value); });
    window.addEventListener("hashchange", () => {
      const h = location.hash.replace("#", "");
      if (h && SECTIONS.some(s => s.id === h)) showSection(h);
      else showPicker();
    });

    // On initial load: if URL hash specifies a section (e.g. returning from a subject page), open it;
    // otherwise show the Section Picker first as requested!
    const initHash = location.hash.replace("#", "");
    if (initHash && SECTIONS.some(s => s.id === initHash)) showSection(initHash);
    else showPicker();
  }

  /* ---------- Maths (KaTeX) ---------- */
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    });
  }
})();
