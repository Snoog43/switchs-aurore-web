const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PRIX = ["< 0.2€/u","< 0.4€/u","< 0.6€/u","< 0.8€/u","< 1€/u","> 1€/u","Indisponible à la vente"];

let all = [], view = [], cur = -1, photoIdx = 0;
const state = {q:"", type:new Set(), son:new Set(), fab:"", prix:"", note:0, audio:false, sort:"note"};

function stars(n, plus){
  if (n == null) return '<span class="meta">non noté</span>';
  let h = "";
  for (let i = 1; i <= 5; i++) h += n >= i ? "★" : n >= i - .5 ? "⯪" : '<span class="off">★</span>';
  return `<span class="stars" title="${String(n).replace(".", ",")} / 5">${h}${plus ? " +" : ""}</span>`;
}
const minDb = s => { const v = s.audios.map(a => a.db).filter(x => x != null); return v.length ? Math.min(...v) : null; };

function chips(el, label, values, set){
  el.innerHTML = `<span class="lab">${label}</span>` + values.map(v => `<button type="button" aria-pressed="false" data-v="${esc(v)}">${esc(v)}</button>`).join("");
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const v = b.dataset.v; set.has(v) ? set.delete(v) : set.add(v);
    b.setAttribute("aria-pressed", set.has(v)); render();
  });
}

function apply(){
  const q = norm(state.q).split(/\s+/).filter(Boolean);
  view = all.filter(s =>
    (!state.type.size || s.type.some(t => state.type.has(t))) &&
    (!state.son.size || [...state.son].every(v => s.son.includes(v))) &&
    (!state.fab || s.fab.includes(state.fab)) &&
    (!state.prix || s.prix === state.prix) &&
    (!state.note || (s.note ?? 0) >= state.note) &&
    (!state.audio || s.audios.some(a => a.f)) &&
    q.every(w => s._txt.includes(w)));
  const by = {
    note: (a, b) => (b.note ?? -1) - (a.note ?? -1) || a.nom.localeCompare(b.nom),
    nom: (a, b) => a.nom.localeCompare(b.nom, "fr"),
    prix: (a, b) => PRIX.indexOf(a.prix) - PRIX.indexOf(b.prix) || (b.note ?? 0) - (a.note ?? 0),
    db: (a, b) => (minDb(a) ?? 99) - (minDb(b) ?? 99),
    date: (a, b) => b.date - a.date,
  }[state.sort];
  view.sort(by);
}

function render(){
  apply();
  $("#result").textContent = `${view.length} switch${view.length > 1 ? "s" : ""} affiché${view.length > 1 ? "s" : ""}`;
  $("#grid").innerHTML = view.length ? view.map((s, i) => `
    <li><article class="card" tabindex="0" data-i="${i}" aria-label="${esc(s.nom)}">
      ${s.photos[0] ? `<img class="thumb" loading="lazy" src="${s.photos[0]}-t.jpg" alt="">` : '<div class="noimg">pas de photo</div>'}
      <div class="cbody">
        <h3>${esc(s.nom)}</h3>
        <div class="tags">${s.type.map(t => `<span class="tag t-${esc(t)}">${esc(t)}</span>`).join("")}${s.son.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        <div class="meta">${esc(s.fab.join(" / "))}</div>
        <div class="bottom">${stars(s.note, s.plus)}<span>${esc(s.prix)}</span></div>
      </div></article></li>`).join("") : '<li class="empty">Aucun switch ne correspond à ces filtres.</li>';
}

function open(i){
  document.querySelectorAll("#d-body audio").forEach(a => a.pause());
  cur = i; photoIdx = 0;
  const s = view[i];
  $("#d-title").textContent = s.nom;
  history.replaceState(null, "", "#" + s.id);
  const specs = [
    ["Type", s.type.join(", ")], ["Fabricant", s.fab.join(" / ")], ["Son", s.son.join(", ")],
    ["Tactilité", [s.tact, s.bump].filter(Boolean).join(", ")], ["Prix", s.prix],
    ["Matériaux", s.mat], ["Ressort", s.ressort], ["Course totale", s.course],
  ].filter(r => r[1]);
  $("#d-body").innerHTML = `
    <div class="cols">
      <div>${s.photos.length ? `
        <div class="viewer"><img id="pimg" src="${s.photos[0]}.jpg" alt="Photo de ${esc(s.nom)}">
          ${s.photos.length > 1 ? '<button class="pv l" type="button" data-d="-1" aria-label="Photo précédente">‹</button><button class="pv r" type="button" data-d="1" aria-label="Photo suivante">›</button>' : ""}</div>
        ${s.photos.length > 1 ? `<div class="minis">${s.photos.map((p, k) => `<button type="button" data-k="${k}" aria-current="${k === 0}"><img src="${p}-t.jpg" alt="Photo ${k + 1}"></button>`).join("")}</div>` : ""}`
        : '<div class="noimg">pas de photo</div>'}</div>
      <div>
        <p style="margin:0 0 10px">${stars(s.note, s.plus)}</p>
        <dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      </div>
    </div>
    ${s.avis ? `<h4>L'avis d'Aurore</h4><div class="avis">${esc(s.avis)}</div>` : ""}
    ${s.audios.length ? `<h4>Enregistrements</h4>
      <div class="aud">${s.audios.map(a => `<div class="a"><p><span><strong>${esc(a.clavier)}</strong> · ${esc(a.label)}</span><span>${a.db != null ? String(a.db).replace(".", ",") + " dB" : ""}</span></p>
        ${a.f ? `<audio controls preload="none" src="${a.f}"></audio>` : `<a href="https://drive.google.com/file/d/${a.fid}/view" target="_blank" rel="noopener">Écouter sur Drive</a>`}</div>`).join("")}</div>` : ""}
    <h4>Liens</h4>
    <div class="links">
      ${s.graph ? `<a href="${esc(s.graph)}" target="_blank" rel="noopener">Courbe de force</a>` : ""}
      ${s.videos.map((v, k) => `<a href="${esc(v)}" target="_blank" rel="noopener">Vidéo${s.videos.length > 1 ? " " + (k + 1) : ""}</a>`).join("")}
      <a href="${s.notion}" target="_blank" rel="noopener">Fiche Notion d'origine</a>
    </div>`;
  const dlg = $("#dlg");
  if (!dlg.open) dlg.showModal();
  $("#d-body").scrollTop = 0;
}

function showPhoto(k){
  const s = view[cur]; const n = s.photos.length;
  photoIdx = (k + n) % n;
  $("#pimg").src = s.photos[photoIdx] + ".jpg";
  document.querySelectorAll(".minis button").forEach((b, j) => b.setAttribute("aria-current", j === photoIdx));
}
function step(d){ if (view.length) open((cur + d + view.length) % view.length); }

function close(){ $("#dlg").close(); }

async function init(){
  const data = await fetch("data.json").then(r => r.json());
  all = data.switchs.map(s => ({...s, _txt: norm([s.nom, s.fab, s.son, s.type, s.avis, s.mat, s.tact, s.bump].flat().join(" "))}));
  $("#src").href = data.source;
  $("#count").textContent = all.length;
  chips($("#f-type"), "Type", ["Linéaire", "Tactile", "Clicky"], state.type);
  chips($("#f-son"), "Son", ["aigu", "grave", "équilibré", "étouffé", "scratchy"], state.son);
  const fabs = {}; all.forEach(s => s.fab.forEach(f => fabs[f] = (fabs[f] || 0) + 1));
  $("#f-fab").innerHTML += Object.entries(fabs).sort((a, b) => b[1] - a[1]).map(([f, n]) => `<option value="${esc(f)}">${esc(f)} (${n})</option>`).join("");
  $("#f-prix").innerHTML += PRIX.filter(p => all.some(s => s.prix === p)).map(p => `<option>${esc(p)}</option>`).join("");

  $("#q").addEventListener("input", e => { state.q = e.target.value; render(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
  $("#f-fab").addEventListener("change", e => { state.fab = e.target.value; render(); });
  $("#f-prix").addEventListener("change", e => { state.prix = e.target.value; render(); });
  $("#f-note").addEventListener("change", e => { state.note = +e.target.value; render(); });
  $("#f-audio").addEventListener("change", e => { state.audio = e.target.checked; render(); });
  $("#reset").addEventListener("click", () => {
    Object.assign(state, {q: "", fab: "", prix: "", note: 0, audio: false}); state.type.clear(); state.son.clear();
    $("#q").value = ""; $("#f-fab").value = ""; $("#f-prix").value = ""; $("#f-note").value = "0"; $("#f-audio").checked = false;
    document.querySelectorAll(".chips button").forEach(b => b.setAttribute("aria-pressed", "false")); render();
  });
  $("#grid").addEventListener("click", e => { const c = e.target.closest(".card"); if (c) open(+c.dataset.i); });
  $("#grid").addEventListener("keydown", e => { const c = e.target.closest(".card"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(+c.dataset.i); } });
  $("#d-prev").onclick = () => step(-1);
  $("#d-next").onclick = () => step(1);
  $("#d-close").onclick = close;
  const dlg = $("#dlg");
  dlg.addEventListener("click", e => {
    if (e.target === dlg) return close();
    const pv = e.target.closest(".pv"); if (pv) return showPhoto(photoIdx + +pv.dataset.d);
    const m = e.target.closest(".minis button"); if (m) showPhoto(+m.dataset.k);
  });
  dlg.addEventListener("close", () => { document.querySelectorAll("audio").forEach(a => a.pause()); history.replaceState(null, "", location.pathname + location.search); });
  dlg.addEventListener("keydown", e => {
    if (e.target.tagName === "AUDIO") return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
  render();
  const id = location.hash.slice(1);
  if (id) { const i = view.findIndex(s => s.id === id); if (i >= 0) open(i); }
}
init();
