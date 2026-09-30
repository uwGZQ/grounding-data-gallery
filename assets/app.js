(() => {
  "use strict";

  const select = document.getElementById("dataset");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const intro = document.getElementById("intro");
  const list = document.getElementById("examples");

  const VIEWS = {
    image: [["overlay", "Overlay"], ["image", "Original"], ["pair", "Side by side"]],
    video: [["overlay", "Overlay video"], ["video", "Original video"], ["sheet", "Contact sheet"]],
  };
  const ABOUT = {
    image: "Each example is one sample from the training loader: the image as loaded, and the same image with every mask and its label drawn on it. The text is exactly what the model reads.",
    video: "Each example is what the training loader hands to the video preprocessor, before frame sampling and resizing. The overlay video draws masks and instance numbers on every rendered frame, with a legend, per-instance presence bars and, for datasets with actions, the action timeline. Frames are thinned to at most 6 fps and 120 frames and play in real time.",
  };

  let datasets = [];   // flat, in dropdown order
  let current = null;
  const fmt = new Intl.NumberFormat("en-US");

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function plural(n, word) { return `${fmt.format(n)} ${word}${n === 1 ? "" : "s"}`; }

  function fact(label, value) {
    return el("div", null, el("dt", { text: label }), el("dd", null, value));
  }

  // JSON.stringify with number-only arrays kept on one line.
  function prettyJson(obj) {
    return JSON.stringify(obj, null, 2).replace(/\[\s+([-\d.eE,\s]+?)\s+\]/g,
      (_, body) => "[" + body.split(/,\s*/).join(", ") + "]");
  }

  function currentView(kind) {
    const saved = store.get(`view:${kind}`);
    return VIEWS[kind].some(([v]) => v === saved) ? saved : VIEWS[kind][0][0];
  }

  function renderIntro(ds) {
    const facts = el("dl", { class: "facts" });
    if (ds.kind === "image") {
      if (ds.stats) {
        facts.append(fact("Images", fmt.format(ds.stats.images)),
                     fact("Annotations", fmt.format(ds.stats.annotations)));
      }
    } else {
      if (ds.group) facts.append(fact("Mixture group", el("code", { text: ds.group })));
      if (ds.group_weight !== undefined) facts.append(fact("Group weight", String(ds.group_weight)));
      if (ds.sampling_rate !== null && ds.sampling_rate !== undefined) facts.append(fact("Sampling rate", String(ds.sampling_rate)));
      if (ds.rows) facts.append(fact("Rows in training parquet", fmt.format(ds.rows)));
      if (ds.source_parquet) facts.append(fact("Source parquet", el("code", { text: ds.source_parquet })));
    }

    const view = currentView(ds.kind);
    const views = el("div", { class: "views", role: "radiogroup", "aria-label": "What to show" },
      VIEWS[ds.kind].map(([value, label]) => el("label", null,
        el("input", { type: "radio", name: "view", value, checked: value === view }),
        el("span", { text: label }))));
    views.addEventListener("change", (e) => {
      store.set(`view:${ds.kind}`, e.target.value);
      renderExamples(ds);
    });

    const parts = [
      el("p", { class: "kind", text: ds.section }),
      el("h1", { text: ds.name }),
      el("p", { class: "about", text: ABOUT[ds.kind] }),
    ];
    if (facts.children.length) parts.push(facts);
    intro.replaceChildren(...parts, views);
  }

  function imageMedia(ds, ex, view) {
    const base = `data/${ds.name}/${ex.id}`;
    const img = (file, alt) => el("img", {
      src: `${base}_${file}`, alt, loading: "lazy", decoding: "async", width: ex.width, height: ex.height,
    });
    const overlay = () => img("overlay.webp", `${ds.name} example ${ex.id} with masks and labels`);
    const original = () => img("image.jpg", `${ds.name} example ${ex.id}, original image`);
    if (view === "pair") {
      return el("div", { class: "media pair" },
        el("figure", null, original(), el("figcaption", { text: "Original" })),
        el("figure", null, overlay(), el("figcaption", { text: "Overlay" })));
    }
    return el("div", { class: "media" }, view === "image" ? original() : overlay());
  }

  function videoMedia(ds, ex, view) {
    const base = `data/${ds.name}/${ex.id}`;
    if (view === "sheet") {
      return el("div", { class: "media" }, el("img", {
        src: `${base}_overlay.jpg`, loading: "lazy", decoding: "async",
        width: ex.contact_sheet[0], height: ex.contact_sheet[1],
        alt: `${ds.name} example ${ex.id}: 8 frames with masks, legend and text`,
      }));
    }
    const file = view === "video" ? "video.mp4" : "overlay.mp4";
    return el("div", { class: "media" }, el("video", {
      src: `${base}_${file}`, controls: true, loop: true, muted: true, playsinline: true,
      preload: "metadata", "aria-label": `${ds.name} example ${ex.id}`,
    }));
  }

  function exampleHead(ds, ex) {
    const parts = [el("span", { class: "badge", text: ex.id })];
    if (ex.row !== null && ex.row !== undefined) parts.push(el("span", null, "Row ", el("strong", { text: fmt.format(ex.row) })));
    if (ds.kind === "video") {
      if (ex.video_id) parts.push(el("span", null, "Video ", el("strong", { class: "mono", text: ex.video_id })));
      if (ex.num_frames) parts.push(el("span", { text: `${plural(ex.num_frames, "frame")} at ${ex.stored_fps} fps (${ex.duration_s} s)` }));
      if (ex.n_rendered && ex.n_rendered !== ex.num_frames) parts.push(el("span", { text: `${ex.n_rendered} rendered` }));
    }
    if (ex.n_instances !== null && ex.n_instances !== undefined) parts.push(el("span", { text: plural(ex.n_instances, "instance") }));
    if (ex.n_actions) parts.push(el("span", { text: plural(ex.n_actions, "action") }));
    if (ex.width && ex.height && ds.kind === "video") parts.push(el("span", { text: `${ex.width}×${ex.height}` }));
    if (ex.augmentation) parts.push(el("span", { text: `Augmentation: ${typeof ex.augmentation === "string" ? ex.augmentation : JSON.stringify(ex.augmentation)}` }));
    if (ds.kind === "video" && ex.checks_clean === false) parts.push(el("span", { class: "flag", text: "Consistency checks flagged (see meta.json)" }));
    return el("div", { class: "ex-head" }, parts);
  }

  function exampleNotes(ds, ex) {
    const base = `data/${ds.name}/${ex.id}`;
    const pre = el("pre", { text: "Loading…" });
    const details = el("details", null, el("summary", { text: "Show meta.json" }), pre);
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.loaded) return;
      details.dataset.loaded = "1";
      fetch(`${base}_meta.json`)
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((m) => { pre.textContent = prettyJson(m); })
        .catch((err) => { pre.textContent = `Could not load meta.json (${err.message}).`; delete details.dataset.loaded; });
    });
    const files = ds.kind === "video"
      ? [["overlay.mp4", "Overlay mp4"], ["video.mp4", "Original mp4"], ["overlay.jpg", "Contact sheet"]]
      : [["overlay.webp", "Overlay image"], ["image.jpg", "Original image"]];
    return el("div", { class: "notes" },
      el("h3", { text: "Text the model reads" }),
      el("p", { class: "text", text: ex.text }),
      details,
      el("div", { class: "links" }, files.map(([f, label]) =>
        el("a", { href: `${base}_${f}`, target: "_blank", rel: "noopener", text: label }))));
  }

  function renderExamples(ds) {
    const view = currentView(ds.kind);
    list.replaceChildren(...ds.examples.map((ex) => el("li", { class: "ex", "data-kind": ds.kind, id: `ex-${ex.id}` },
      exampleHead(ds, ex),
      el("div", { class: "ex-body" },
        ds.kind === "video" ? videoMedia(ds, ex, view) : imageMedia(ds, ex, view),
        exampleNotes(ds, ex)))));
  }

  function show(name, { push = true } = {}) {
    const idx = datasets.findIndex((d) => d.name === name);
    const ds = datasets[idx >= 0 ? idx : 0];
    current = ds;
    select.value = ds.name;
    prevBtn.disabled = datasets.indexOf(ds) === 0;
    nextBtn.disabled = datasets.indexOf(ds) === datasets.length - 1;
    document.title = `${ds.name} · Grounding data gallery`;
    if (push && location.hash.slice(1) !== ds.name) history.pushState(null, "", `#${ds.name}`);
    renderIntro(ds);
    renderExamples(ds);
  }

  function step(delta) {
    const i = datasets.indexOf(current) + delta;
    if (i < 0 || i >= datasets.length) return;
    show(datasets[i].name);
    window.scrollTo({ top: 0 });
  }

  function init(manifest) {
    select.replaceChildren();
    for (const section of manifest.sections) {
      const group = el("optgroup", { label: section.title });
      for (const ds of section.datasets) {
        ds.section = section.title;
        datasets.push(ds);
        group.append(el("option", { value: ds.name, text: ds.name }));
      }
      select.append(group);
    }
    select.disabled = false;
    select.addEventListener("change", () => { show(select.value); window.scrollTo({ top: 0 }); });
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));
    window.addEventListener("popstate", () => show(decodeURIComponent(location.hash.slice(1)), { push: false }));
    document.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea", "video", "button"].includes(tag)) return;
      if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
      if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
    });
    const fromHash = decodeURIComponent(location.hash.slice(1));
    show(datasets.some((d) => d.name === fromHash) ? fromHash : datasets[0].name, { push: false });
  }

  fetch("manifest.json")
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(init)
    .catch((err) => {
      select.replaceChildren(el("option", { text: "Datasets unavailable" }));
      intro.replaceChildren(el("p", { class: "status error",
        text: `Could not load manifest.json (${err.message}). Serve this folder over HTTP, for example with "python -m http.server", then reload.` }));
    });
})();
