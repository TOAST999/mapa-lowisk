"use strict";

const byId = id => document.getElementById(id);
const collator = new Intl.Collator("pl");
const metres = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
const portable = window.ATLAS_PREVIEW;
const second = () => Math.floor(Date.now() / 1000);
let lakes = [], reports = [], map, currentLake = null;
let ready = false, reachable = false, busy = false, generation = 0;
let fingerprint = null;

function normalized(value) {
  return value.toLocaleLowerCase("pl").replaceAll("ł","l").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function cap(value) { return value.charAt(0).toLocaleUpperCase("pl") + value.slice(1); }
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function action(label, run, css = "primary") {
  const button = node("button", label, css);
  button.type = "button"; button.onclick = run;
  return button;
}
async function readJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Nie można połączyć się z serwerem atlasu.");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Nie udało się zapisać zmiany.");
  return body;
}

function renderCatalogue(reframe = false) {
  const region = byId("region").value;
  const words = normalized(byId("search").value.trim()).split(/\s+/).filter(Boolean);
  const visible = lakes.filter(lake => (!region || lake.region === region) && words.every(word => lake.search.includes(word)));
  byId("result-count").textContent = visible.length + " z " + lakes.length;
  byId("map-title").textContent = region ? cap(region) : "Polska";
  const fragment = document.createDocumentFragment();
  const activeIds = new Set(reports.filter(report => report.expires > second()).map(report => report.lake));
  for (const lake of visible) {
    const row = node("button", undefined, "lake-row"), label = node("span");
    row.dataset.lake = lake.id;
    label.append(node("b", lake.name), node("small", lake.town + " · " + cap(lake.region)));
    if (activeIds.has(lake.id)) label.append(node("small", "Próbne zgłoszenie", "notice-label"));
    row.append(label, node("span", metres.format(lake.depth) + " m", "depth-mini"));
    row.onclick = () => openLake(lake);
    fragment.append(row);
  }
  if (!visible.length) {
    const blank = node("div", undefined, "empty");
    const hasData = lakes.some(lake => lake.region === region);
    blank.append(node("p", region && !hasData ? "To województwo czeka na uzupełnienie. Pilotaż obejmuje trzy regiony." : "Brak łowisk pasujących do tych filtrów."),
      action("Pokaż wszystkie łowiska", () => { byId("search").value = ""; chooseRegion(""); }, "secondary"));
    fragment.append(blank);
  }
  const prior = byId("lake-list").contains(document.activeElement) ? document.activeElement?.dataset.lake : null;
  byId("lake-list").replaceChildren(fragment);
  if (prior) byId("lake-list").querySelector('[data-lake="' + prior + '"]')?.focus({preventScroll:true});
  map.activeIds = activeIds;
  map.update(visible, region, reframe);
}

function chooseRegion(region) {
  byId("region").value = region;
  renderCatalogue(true);
}

function openLake(lake) {
  currentLake = lake;
  byId("detail-name").textContent = lake.name;
  byId("detail-region").textContent = "Województwo " + lake.region;
  byId("detail-town").textContent = lake.town;
  byId("detail-depth").textContent = metres.format(lake.depth) + " m";
  byId("detail-fish").replaceChildren(...lake.fish.map(fish => node("li", fish)));
  byId("detail-sources").replaceChildren(...lake.sources.map(([label,url]) => {
    const li = node("li"), link = node("a",label);
    link.href = url; link.target = "_blank"; link.rel = "noreferrer"; li.append(link); return li;
  }));
  document.querySelector("#lake-dialog .sources").open = false;
  byId("report-status").textContent = "";
  renderReports();
  if (!byId("lake-dialog").open) byId("lake-dialog").showModal();
  refresh();
}

function renderReports() {
  if (!currentLake) return;
  const area = byId("report-actions"), intro = byId("report-intro");
  const focusKey = area.contains(document.activeElement) ? document.activeElement.textContent : null;
  area.replaceChildren();
  if (!ready) { intro.textContent = "Wczytywanie próbnych zgłoszeń…"; return; }
  if (!reachable) {
    intro.textContent = "Moduł zgłoszeń chwilowo nie odpowiada.";
    area.append(action("Spróbuj ponownie", () => refresh(), "secondary"));
    return;
  }
  const entry = reports.find(report => report.lake === currentLake.id && report.expires > second());
  if (!entry) {
    intro.textContent = "Brak aktywnego zgłoszenia. Dodaj fikcyjną kontrolę na potrzeby pokazu.";
    area.append(action("Dodaj próbne zgłoszenie", () => modify("/api/zgloszenia", {lake: currentLake.id})));
  } else {
    const status = entry.flags ? "Zakwestionowane" : entry.confirmations ? "Potwierdzone" : "Niepotwierdzone";
    intro.textContent = status + " · dodano " + clock.format(entry.created * 1000) + " · wygaśnie " +
      clock.format(entry.expires * 1000) + ". Potwierdzenia: " + entry.confirmations + ". Oznaczenia błędu: " + entry.flags + ".";
    if (entry.mine) {
      area.append(node("span", "To Twój wpis. Inny tester może go ocenić.", "own-note"));
    } else {
      const path = "/api/zgloszenia/" + entry.id + "/glos";
      const confirm = action(entry.vote === "confirm" ? "Potwierdzono" : "Potwierdź", () => modify(path, { kind: "confirm" }));
      const flag = action(entry.vote === "flag" ? "Oznaczono jako błędne" : "Oznacz jako błędne", () => modify(path, { kind: "flag" }), "secondary");
      confirm.disabled = entry.vote === "confirm"; flag.disabled = entry.vote === "flag";
      area.append(confirm, flag);
    }
  }
  for (const button of area.querySelectorAll("button")) {
    if (busy) button.disabled = true;
    if (focusKey === button.textContent && !button.disabled) button.focus({preventScroll:true});
  }
}

function accept(recs, isOnline) {
  ready = true; reachable = isOnline;
  const live = recs.filter(item => item.expires > second());
  const signature = JSON.stringify([live, isOnline]);
  if (signature === fingerprint) return;
  fingerprint = signature; reports = live;
  renderCatalogue();
  renderReports();
}

async function refresh() {
  if (busy) return;
  const request = ++generation;
  try {
    const data = portable ? {reports: previewEntries()} : await readJSON("/api/zgloszenia");
    if (request === generation) accept(data.reports, true);
  } catch {
    if (request === generation) accept(reports, false);
  }
}

async function modify(path, data) {
  if (busy || !currentLake) return;
  const shown = currentLake.id;
  busy = true; ++generation; renderReports();
  byId("report-status").textContent = "";
  let message;
  try {
    const result = portable ? previewChange(path, data) : await readJSON(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    });
    accept(result.reports, true);
    message = data.lake ? "Dodano próbne zgłoszenie." : "Zapisano Twój głos.";
  } catch (error) {
    message = error.message;
  } finally {
    busy = false;
    if (currentLake?.id === shown) byId("report-status").textContent = message;
    renderReports();
    refresh();
  }
}

// The optional single-file demonstration uses three explicit test identities.
// The normal application always uses the shared server and its SQLite database.
const demoEvents = new Map();
let demoActor = "A", demoNumber = 0;
function previewEntries() {
  const entries = [];
  for (const [id, entry] of demoEvents) {
    if (entry.created + 7200 <= second()) { demoEvents.delete(id); continue; }
    const votes = [...entry.votes.values()];
    entries.push({id, lake:entry.lake, created:entry.created, expires:entry.created + 7200,
      mine:entry.author === demoActor, vote:entry.votes.get(demoActor) || null,
      confirmations:votes.filter(vote => vote === "confirm").length, flags:votes.filter(vote => vote === "flag").length});
  }
  return entries;
}
function previewChange(path, data) {
  const entries = previewEntries();
  if (data.lake) {
    if (entries.some(entry => entry.lake === data.lake)) throw new Error("Na łowisku jest już aktywny wpis.");
    demoEvents.set(++demoNumber,{lake:data.lake,created:second(),author:demoActor,votes:new Map()});
  } else {
    const id = Number(path.split("/")[3]), entry = demoEvents.get(id);
    if (!entry) throw new Error("Ten wpis już wygasł.");
    if (entry.author === demoActor) throw new Error("Wybierz innego testera.");
    entry.votes.set(demoActor, data.kind);
    if ([...entry.votes.values()].filter(vote => vote === "flag").length >= 2) demoEvents.delete(id);
  }
  return { reports:previewEntries() };
}
function configureDialogs() {
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => button.closest("dialog").close());
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
  }
  byId("lake-dialog").addEventListener("close", () => { currentLake = null; });
  byId("about-open").onclick = () => byId("about-dialog").showModal();
  byId("about-mode").textContent = portable
    ? "W tym pokazie możesz przełączać role testerów. Przykładowe wpisy znikną po odświeżeniu strony."
    : "Na wspólnym serwerze testerzy widzą te same wpisy. Każda przeglądarka może oddać jeden głos pod cudzym zgłoszeniem.";
  if (portable) {
    const box = node("div", undefined, "demo-role");
    const label = node("label","Rola w pokazie");
    label.htmlFor = "demo-actor";
    const select = node("select"); select.id = "demo-actor";
    for (const actor of ["A","B","C"]) select.add(new Option("Tester " + actor, actor));
    select.onchange = () => { demoActor = select.value; byId("report-status").textContent = ""; refresh(); };
    box.append(label,select);
    byId("report-heading").closest("section").insertBefore(box, byId("report-intro"));
  }
}
async function start() {
  configureDialogs();
  try {
    const [data, regions] = portable ? [portable.lakes,portable.regions] :
      await Promise.all([readJSON("static/lowiska.json"),readJSON("static/regiony.json")]);
    lakes = data.map(lake => ({ ...lake, search:normalized([lake.name,lake.town,lake.region,...lake.fish].join(" ")) }))
      .sort((a,b) => collator.compare(a.name,b.name));
    const regionSelect = byId("region");
    const names = regions.map(region => region.name).sort((a,b) => collator.compare(a,b));
    for (const name of names) {
      const count = lakes.filter(lake => lake.region === name).length;
      regionSelect.add(new Option(cap(name) + " (" + count + ")", name));
    }
    map = new AtlasMap(regions,lakes,chooseRegion,openLake);
    byId("search").addEventListener("input",() => renderCatalogue());
    regionSelect.addEventListener("change",() => chooseRegion(regionSelect.value));
    renderCatalogue(true);
    await refresh();
    setInterval(() => { if (!document.hidden) refresh(); },10000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  } catch {
    byId("app-status").textContent = location.protocol === "file:"
      ? "Uruchom pełną aplikację poleceniem python serwer.py. Do pokazu bez serwera otwórz plik Atlas_lowisk.html."
      : "Nie udało się wczytać atlasu. Odśwież stronę lub sprawdź, czy serwer ma pliki z danymi.";
  }
}
start();
