"use strict";

// A local equirectangular projection with a standard parallel at 52° N.
// Geographic data use [longitude, latitude]; screen Y runs downwards.
const LONGITUDE_SCALE = Math.cos(52 * Math.PI / 180);
function geoBounds(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
}

function containsPoint(rings, lon, lat) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > lat) !== (by > lat) && lon < (bx - ax) * (lat - ay) / (by - ay) + ax) inside = !inside;
    }
  }
  return inside;
}

class AtlasMap {
  constructor(regions, lakes, onRegion, onLake) {
    this.box = document.querySelector("#map");
    this.canvas = document.querySelector("#geography");
    this.ctx = this.canvas.getContext("2d");
    this.pins = document.querySelector("#pins");
    this.regions = regions.map(region => ({ ...region, bounds: geoBounds(region.rings.flat()) }));
    this.country = geoBounds(regions.flatMap(region => region.rings.flat()));
    this.pilot = new Set(lakes.map(lake => lake.region));
    this.lakes = lakes;
    this.activeIds = new Set();
    this.onRegion = onRegion;
    this.onLake = onLake;
    this.selected = "";
    this.center = [19.2, 52.1];
    this.scale = 1;
    this.lastSize = 0;
    this.drag = null;
    this.installControls();
    this.observer = new ResizeObserver(() => {
      const size = this.fitScale(this.country);
      if (this.lastSize) this.scale *= size / this.lastSize;
      else this.frame(this.country);
      this.lastSize = size;
      this.draw();
    });
    this.observer.observe(this.box);
    this.frame(this.country);
    this.draw();
    document.fonts.ready.then(() => this.draw());
  }

  fitScale(bounds) {
    const w = Math.max(1, this.box.clientWidth - 44);
    const h = Math.max(1, this.box.clientHeight - 38);
    return Math.min(w / Math.max(.045, (bounds.east - bounds.west) * LONGITUDE_SCALE),
                    h / Math.max(.045, bounds.north - bounds.south));
  }

  frame(bounds) {
    this.center = [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];
    this.scale = Math.min(12000, this.fitScale(bounds));
  }

  update(lakes, region, reframe) {
    this.lakes = lakes;
    this.selected = region;
    if (reframe) this.frame(this.regions.find(item => item.name === region)?.bounds || this.country);
    this.draw();
  }

  project(lon, lat) {
    return [(lon - this.center[0]) * this.scale * LONGITUDE_SCALE + this.box.clientWidth / 2,
            (this.center[1] - lat) * this.scale + this.box.clientHeight / 2];
  }

  unproject(x, y) {
    return [this.center[0] + (x - this.box.clientWidth / 2) / (this.scale * LONGITUDE_SCALE),
            this.center[1] - (y - this.box.clientHeight / 2) / this.scale];
  }

  zoom(factor, x = this.box.clientWidth / 2, y = this.box.clientHeight / 2) {
    const before = this.unproject(x, y);
    this.scale = Math.max(this.fitScale(this.country) * .75, Math.min(12000, this.scale * factor));
    const after = this.unproject(x, y);
    this.center = [this.center[0] + before[0] - after[0], this.center[1] + before[1] - after[1]];
    this.draw();
  }

  installControls() {
    document.querySelector("#zoom-in").onclick = () => this.zoom(1.7);
    document.querySelector("#zoom-out").onclick = () => this.zoom(1 / 1.7);
    document.querySelector("#map-home").onclick = () => this.onRegion("");
    this.canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.drag) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, center: [...this.center], moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", event => {
      const start = this.drag;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 5) return;
      start.moved = true;
      this.box.classList.add("dragging");
      this.center = [start.center[0] - dx / (this.scale * LONGITUDE_SCALE), start.center[1] + dy / this.scale];
      this.draw();
    });
    this.canvas.addEventListener("pointerup", event => {
      const start = this.drag;
      if (!start || start.id !== event.pointerId) return;
      this.drag = null;
      this.box.classList.remove("dragging");
      if (start.moved) return;
      const rect = this.canvas.getBoundingClientRect();
      const [lon, lat] = this.unproject(event.clientX - rect.left, event.clientY - rect.top);
      const region = this.regions.find(entry => containsPoint(entry.rings, lon, lat));
      if (region) this.onRegion(region.name);
    });
    this.canvas.addEventListener("pointercancel", () => {
      this.drag = null;
      this.box.classList.remove("dragging");
    });
    this.canvas.addEventListener("wheel", event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoom(event.deltaY < 0 ? 1.25 : .8, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
  }

  grid(ctx, w, h) {
    const step = this.scale > 1600 ? .05 : this.scale > 520 ? .25 : this.scale > 180 ? .5 : 1;
    const [west, north] = this.unproject(0, 0), [east, south] = this.unproject(w, h);
    ctx.strokeStyle = "#d9dfce"; ctx.lineWidth = .7; ctx.beginPath();
    for (let x = Math.ceil(west / step) * step; x <= east; x += step) {
      const px = this.project(x, north)[0]; ctx.moveTo(px, 0); ctx.lineTo(px, h);
    }
    for (let y = Math.ceil(south / step) * step; y <= north; y += step) {
      const py = this.project(west, y)[1]; ctx.moveTo(0, py); ctx.lineTo(w, py);
    }
    ctx.stroke();
  }

  draw() {
    const w = this.box.clientWidth, h = this.box.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(w * dpr), height = Math.round(h * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.grid(ctx, w, h);
    const labels = [];
    for (const region of this.regions) {
      const b = region.bounds, left = this.project(b.west, b.north), right = this.project(b.east, b.south);
      if (right[0] < 0 || left[0] > w || right[1] < 0 || left[1] > h) continue;
      ctx.beginPath();
      for (const ring of region.rings) {
        ring.forEach(([lon, lat], index) => {
          const [x, y] = this.project(lon, lat);
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      const pilot = this.pilot.has(region.name);
      ctx.fillStyle = region.name === this.selected ? "#c2d6a8" : pilot ? "#d1dfb8" : "#f8f7e9";
      ctx.fill("evenodd"); ctx.strokeStyle = pilot ? "#819779" : "#afb7a0";
      ctx.lineWidth = region.name === this.selected ? 1.7 : 1; ctx.stroke();
      const x = (left[0] + right[0]) / 2, y = (left[1] + right[1]) / 2;
      if (x < 12 || x > w - 12 || y < 12 || y > h - 12) continue;
      const words = region.name.split("-");
      const labelSize = w < 470 ? 9 : 11;
      ctx.font = (pilot ? "600 " : "400 ") + labelSize + "px 'DM Sans', sans-serif";
      if (Math.max(...words.map(word => ctx.measureText(word).width)) > (right[0] - left[0]) * 1.1) continue;
      labels.push({ x, y, words, pilot, labelSize });
    }
    for (const {x,y,words,pilot,labelSize} of labels) {
      ctx.font = (pilot ? "600 " : "400 ") + labelSize + "px 'DM Sans', sans-serif";
      ctx.textAlign = "center"; ctx.fillStyle = pilot ? "#4d694c" : "#73816c";
      words.forEach((word,i) => ctx.fillText(word + (i < words.length - 1 ? "-" : ""), x, y + (i - (words.length - 1) / 2) * 12));
    }
    ctx.textAlign = "left"; ctx.fillStyle = "#405a45"; ctx.font = "600 10px 'DM Sans', sans-serif";
    ctx.fillText("N", 16, 23); ctx.beginPath(); ctx.moveTo(19, 27); ctx.lineTo(16, 37); ctx.lineTo(19, 35); ctx.lineTo(22, 37); ctx.closePath(); ctx.fill();
    this.renderPins(w, h);
  }

  renderPins(w, h) {
    const groups = [];
    for (const lake of this.lakes) {
      const [x,y] = this.project(lake.lon,lake.lat);
      if (x < -12 || y < -12 || x > w + 12 || y > h + 12) continue;
      const group = groups.find(item => Math.hypot(item.x - x, item.y - y) < 35);
      if (!group) groups.push({ x, y, lakes: [lake] });
      else {
        group.lakes.push(lake);
        group.x += (x - group.x) / group.lakes.length;
        group.y += (y - group.y) / group.lakes.length;
      }
    }
    const focusedKey = this.pins.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const fragment = document.createDocumentFragment();
    let restoreFocus = null;
    for (const group of groups) {
      const button = document.createElement("button"), many = group.lakes.length > 1;
      button.className = many ? "pin cluster" : "pin";
      button.dataset.key = group.lakes.map(lake => lake.id).join("-");
      button.style.left = group.x + "px"; button.style.top = group.y + "px";
      const names = group.lakes.map(lake => lake.name).join(", ");
      const hasNotice = group.lakes.some(lake => this.activeIds.has(lake.id));
      if (hasNotice) button.classList.add("with-report");
      button.title = (many ? "Powiększ grupę: " + names : names) + (hasNotice ? " · próbne zgłoszenie" : "");
      button.setAttribute("aria-label", button.title);
      if (many) button.textContent = group.lakes.length;
      button.onclick = () => {
        if (!many) { this.onLake(group.lakes[0]); return; }
        this.frame(geoBounds(group.lakes.map(lake => [lake.lon,lake.lat])));
        this.scale *= .87;
        this.draw();
        this.pins.querySelector("button")?.focus({preventScroll:true});
      };
      if (button.dataset.key === focusedKey) restoreFocus = button;
      fragment.append(button);
    }
    this.pins.replaceChildren(fragment);
    if (restoreFocus) restoreFocus.focus({preventScroll:true});
  }
}
