// ============================================================
//  API CLIENT — talks to Express/MongoDB backend
// ============================================================
const API = {
  base: '/api',

  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  },

  async post(path, body) {
    const r = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  },

  async put(path, body) {
    const r = await fetch(this.base + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  },

  async delete(path) {
    const r = await fetch(this.base + path, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  },

  async uploadFile(path, fieldName, file) {
    const fd = new FormData();
    fd.append(fieldName, file);
    const r = await fetch(this.base + path, { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  }
};

// ============================================================
//  APP STATE
// ============================================================
let DB = [];
let currentFilter = 'All';
let statsAnimated = false;

// ============================================================
//  LOAD ALL SPECIES FROM SERVER
// ============================================================
async function loadSpecies(filter = 'All') {
  try {
    let url = '/species?limit=200';
    if (filter !== 'All' && filter !== 'Extinct') url += `&cat=${encodeURIComponent(filter)}`;
    if (filter === 'Extinct') url += `&status=Extinct`;
    const res = await API.get(url);
    DB = res.data;
    buildSpeciesGrid(filter);
  } catch (err) {
    showToast('Failed to load species: ' + err.message, 'error');
  }
}

// ============================================================
//  SPECIES GRID
// ============================================================
function buildSpeciesGrid(filter) {
  const grid = document.getElementById('spGrid');
  if (!grid) return;

  let data = DB;
  if (filter && filter !== 'All') {
    if (filter === 'Extinct') data = DB.filter(s => s.status === 'Extinct');
    else data = DB.filter(s => s.cat === filter);
  }

  if (!data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--txt-light)">
      <div style="font-size:48px;margin-bottom:12px">🔍</div>
      <div style="font-size:16px;font-weight:600">No species found</div>
    </div>`;
    return;
  }

  grid.innerHTML = data.map(sp => {
    const coverImg = sp.images && sp.images.length > 0 ? sp.images[0].url : (sp.img || '');
    const hasVid   = (sp.videos && sp.videos.length > 0) || sp.vid;
    return `
    <div class="sp-card" onclick="openSpeciesModal('${sp._id}')">
      <div class="sp-img">
        <img src="${coverImg}" alt="${sp.name}" loading="lazy" referrerpolicy="no-referrer"
          style="width:100%;height:100%;object-fit:cover;min-height:210px;background:#1a3a2a"
          onerror="if(!this.dataset.tried){this.dataset.tried=1;this.src='${sp.img||''}'}else{this.style.opacity='0.3'}">
        <div class="sp-badge ${statusBg(sp.status)}">${sp.status}</div>
        ${hasVid ? `<div class="sp-video-play"><span>▶</span></div>` : ''}
        <div class="sp-media-badge">
          ${sp.images && sp.images.length > 0 ? `<span>📷 ${sp.images.length}</span>` : ''}
          ${sp.videos && sp.videos.length > 0 ? `<span>🎬 ${sp.videos.length}</span>` : ''}
        </div>
        <div class="sp-upload-overlay">
          <button class="sp-upload-btn" title="Add image" onclick="event.stopPropagation();uploadSpeciesImageById('${sp._id}')">📷</button>
          <button class="sp-upload-btn" title="Add video" onclick="event.stopPropagation();uploadSpeciesVideoById('${sp._id}')">🎬</button>
        </div>
      </div>
      <div class="sp-body">
        <div class="sp-nm">${sp.name}</div>
        <div class="sp-sci">${sp.sci}</div>
        <div class="sp-meta">
          <span>📍 ${sp.cat}</span>
          ${sp.habitat ? `<span title="${sp.habitat}">🌍</span>` : ''}
        </div>
        <div class="sp-pop">
          <div class="sp-pop-l">${sp.status === 'Extinct' ? 'Status' : 'Est. Population'}</div>
          <div class="sp-pop-v">${sp.status === 'Extinct' ? 'Extinct' : (sp.pop != null ? Number(sp.pop).toLocaleString() : 'Unknown')}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  SPECIES MODAL — loads from API by ID
// ============================================================
async function openSpeciesModal(id) {
  const box = document.getElementById('modalBox');
  box.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:400px">
    <div style="text-align:center;color:var(--txt-mid)">
      <div style="font-size:40px;animation:lSpin 1.5s linear infinite">🌿</div>
      <div style="margin-top:12px;font-size:13px">Loading...</div>
    </div></div>`;
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res = await API.get(`/species/${id}`);
    const sp  = res.data;
    renderModal(sp);
  } catch (err) {
    box.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger)">${err.message}</div>`;
  }
}

function renderModal(sp) {
  const coverImg = sp.images && sp.images.length > 0 ? sp.images[0].url : (sp.img || '');

  // Video HTML
  let vidHtml = '';
  if (sp.videos && sp.videos.length > 0) {
    vidHtml = `<div class="m-sec">
      <div class="m-sec-t">🎬 Uploaded Video</div>
      <div class="m-vid">
        <video src="${sp.videos[0].url}" controls style="width:100%;height:100%;border-radius:12px"></video>
      </div>
    </div>`;
  } else if (sp.vid) {
    vidHtml = `<div class="m-sec">
      <div class="m-sec-t">🎬 Video — ${sp.name}</div>
      <div class="m-vid" id="ytHolder_${sp.vid}" style="position:relative;background:#111;border-radius:12px;overflow:hidden;cursor:pointer;aspect-ratio:16/9"
        onclick="document.getElementById('ytHolder_${sp.vid}').innerHTML='<iframe style=\\'width:100%;height:100%;border:none\\' src=\\'https://www.youtube.com/embed/${sp.vid}?autoplay=1&rel=0\\' allow=\\'autoplay;encrypted-media;fullscreen\\' allowfullscreen></iframe>'">
        <img src="https://img.youtube.com/vi/${sp.vid}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover" referrerpolicy="no-referrer">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)">
          <div style="width:72px;height:72px;background:rgba(220,0,0,.92);border-radius:50%;display:flex;align-items:center;justify-content:center">
            <div style="width:0;height:0;border-top:15px solid transparent;border-bottom:15px solid transparent;border-left:26px solid white;margin-left:6px"></div>
          </div>
        </div>
        <div style="position:absolute;bottom:10px;left:14px;color:rgba(255,255,255,.85);font-size:13px;font-weight:600">▶ Click to watch</div>
      </div>
    </div>`;
  }

  // Image gallery
  const allImages = sp.images || [];
  const allVideos = sp.videos || [];

  const galleryHtml = (allImages.length + allVideos.length) > 0 ? `
    <div class="m-sec">
      <div class="m-sec-t">📷 Media Gallery
        <span style="margin-left:auto;font-size:11px;color:var(--txt-light);font-weight:400">${allImages.length} images · ${allVideos.length} videos</span>
      </div>
      <div class="m-gallery">
        ${allImages.map(m => `
        <div class="m-gallery-item">
          <img src="${m.url}" alt="${sp.name}" loading="lazy">
          <button class="m-gallery-del" onclick="deleteMedia('${sp._id}','image','${m._id}')">✕</button>
        </div>`).join('')}
        ${allVideos.map(m => `
        <div class="m-gallery-item">
          <video src="${m.url}" muted></video>
          <div class="play-icon"><span>▶</span></div>
          <button class="m-gallery-del" onclick="deleteMedia('${sp._id}','video','${m._id}')">✕</button>
        </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('modalBox').innerHTML = `
    <button class="m-close" onclick="closeModal()">✕</button>
    <div class="m-hero">
      <img src="${coverImg}" alt="${sp.name}" referrerpolicy="no-referrer"
        style="width:100%;height:100%;object-fit:cover"
        onerror="if(!this.dataset.tried){this.dataset.tried=1;this.src='${sp.img||''}'}">
      <div class="m-hero-ov">
        <div class="m-name">${sp.emoji||'🐾'} ${sp.name}</div>
        <div class="m-sci">${sp.sci}</div>
      </div>
    </div>
    <div class="m-body">
      <div class="m-chips">
        <span class="m-chip" style="background:${statusColor(sp.status)}22;color:${statusColor(sp.status)};border:1px solid ${statusColor(sp.status)}44">● ${sp.status}</span>
        <span class="m-chip" style="background:#f0f0f0;color:#555">📍 ${sp.cat}</span>
        ${sp.pop ? `<span class="m-chip" style="background:#e8f5e9;color:#2d6a3f">👥 ${Number(sp.pop).toLocaleString()} left</span>` : ''}
        ${sp.years ? `<span class="m-chip" style="background:#fff3e0;color:#7a4a00">⏳ ${sp.years}</span>` : ''}
      </div>
      <div class="m-sec"><div class="m-sec-t">🌍 Habitat</div><p>${sp.habitat||'Unknown'}</p></div>
      <div class="m-sec"><div class="m-sec-t">📖 About ${sp.name}</div><p>${sp.desc||''}</p></div>
      ${sp.behavior ? `<div class="m-sec"><div class="m-sec-t">🧠 Behavior</div><p>${sp.behavior}</p></div>` : ''}
      <div class="m-sec">
        <div class="m-sec-t">⚠️ Threats</div>
        <ul class="m-causes">
          ${(sp.causes||[]).map(c => `<li><div class="cause-i">⚡</div>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="m-sec"><div class="m-sec-t">🛡️ Conservation</div><p>${sp.conservation||''}</p></div>
      ${vidHtml}
      ${galleryHtml}

      <!-- Upload zone -->
      <div class="m-upload-zone"
        ondragover="event.preventDefault();this.classList.add('dragging')"
        ondragleave="this.classList.remove('dragging')"
        ondrop="handleModalDrop(event,'${sp._id}')">
        <div class="m-upload-icon">📎</div>
        <div class="m-upload-text">Drag & drop or click to upload media</div>
        <div class="m-upload-hint">Images (JPG/PNG/WebP, max 10MB) · Videos (MP4/WebM, max 100MB)</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn-p" style="font-size:12px;padding:9px 20px" onclick="uploadSpeciesImageById('${sp._id}',true)">📷 Upload Image</button>
          <button class="btn-s" style="font-size:12px;padding:9px 20px;color:var(--txt);border-color:#ccc" onclick="uploadSpeciesVideoById('${sp._id}',true)">🎬 Upload Video</button>
        </div>
        <div id="uploadProgress" style="display:none;margin-top:12px">
          <div style="height:4px;background:var(--cream-dark);border-radius:2px;overflow:hidden">
            <div id="uploadBar" style="height:100%;background:var(--sunset);border-radius:2px;width:0;transition:width .3s"></div>
          </div>
          <div id="uploadLabel" style="font-size:11px;text-align:center;color:var(--txt-light);margin-top:4px">Uploading...</div>
        </div>
      </div>
    </div>`;
}

// ============================================================
//  UPLOAD — via FormData to API
// ============================================================
async function uploadSpeciesImageById(id, reopenModal = false) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files[0]) return;
    await doUpload(id, 'image', input.files[0], reopenModal);
  };
  input.click();
}

async function uploadSpeciesVideoById(id, reopenModal = false) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'video/*';
  input.onchange = async () => {
    if (!input.files[0]) return;
    await doUpload(id, 'video', input.files[0], reopenModal);
  };
  input.click();
}

async function handleModalDrop(e, id) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const type = file.type.startsWith('image/') ? 'image' : 'video';
  await doUpload(id, type, file, true);
}

async function doUpload(id, type, file, reopenModal) {
  const prog  = document.getElementById('uploadProgress');
  const bar   = document.getElementById('uploadBar');
  const label = document.getElementById('uploadLabel');

  if (prog) { prog.style.display = 'block'; bar.style.width = '20%'; label.textContent = 'Uploading...'; }

  try {
    showToast(`Uploading ${type}...`, 'info');
    const res = await API.uploadFile(`/species/${id}/${type}`, type, file);

    if (prog) { bar.style.width = '100%'; label.textContent = 'Done!'; }
    showToast(`${type === 'image' ? '📷 Image' : '🎬 Video'} uploaded for ${res.species.name}!`);

    // Refresh grid
    await loadSpecies(currentFilter);

    // Refresh modal if open
    if (reopenModal) setTimeout(() => openSpeciesModal(id), 400);

  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
    if (prog) { prog.style.display = 'none'; }
  }
}

// ============================================================
//  DELETE MEDIA
// ============================================================
async function deleteMedia(speciesId, type, mediaId) {
  if (!confirm(`Remove this ${type}?`)) return;
  try {
    await API.delete(`/species/${speciesId}/${type}/${mediaId}`);
    showToast(`${type} removed`);
    await loadSpecies(currentFilter);
    openSpeciesModal(speciesId);
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// ============================================================
//  CLOSE MODAL
// ============================================================
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ============================================================
//  STATUS HELPERS
// ============================================================
function statusColor(s) {
  return { 'Critically Endangered':'#ff6b35','Endangered':'#f5a623','Extinct':'#dc3545','Vulnerable':'#9b59b6','Rare':'#1a7a9e' }[s] || '#888';
}
function statusBg(s) {
  return { 'Critically Endangered':'bg-critical','Endangered':'bg-endangered','Extinct':'bg-extinct','Vulnerable':'bg-vulnerable','Rare':'bg-rare' }[s] || 'bg-rare';
}

// ============================================================
//  FILTER BAR
// ============================================================
const allFilters = ['All','Mammals','Birds','Insects','Marine Life','Reptiles & Amphibians','Extinct'];

function buildFilterBar() {
  const bar = document.getElementById('fltBar');
  if (!bar) return;
  bar.innerHTML = allFilters.map(f => `
    <button class="flt-btn${f === 'All' ? ' on' : ''}" data-cat="${f}" onclick="setFilter('${f}')">${f}</button>
  `).join('');
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.flt-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === f));
  loadSpecies(f);
}

function filterByCategory(cat) {
  currentFilter = cat;
  loadSpecies(cat);
  document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
  document.querySelectorAll('.flt-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
}

// ============================================================
//  CATEGORY GRID
// ============================================================
const catImgs = {
  "Mammals": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/6/68/Mountain_Gorilla%2C_Pair_%286972178908%29.jpg/800px-Mountain_Gorilla%2C_Pair_%286972178908%29.jpg&w=600",
  "Birds": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Pithecophaga_jefferyi_-Philippine_Eagle_Center%2C_Davao_City%2C_Philippines-8a_%281%29.jpg/800px-Pithecophaga_jefferyi_-Philippine_Eagle_Center%2C_Davao_City%2C_Philippines-8a_%281%29.jpg&w=600",
  "Insects": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/6/63/Monarch_In_May.jpg/800px-Monarch_In_May.jpg&w=600",
  "Marine Life": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg/800px-Anim1754_-_Flickr_-_NOAA_Photo_Library.jpg&w=600",
  "Reptiles & Amphibians": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Hawksbill_sea_turtle.jpg/800px-Hawksbill_sea_turtle.jpg&w=600",
  "Plants & Flowers": "https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/1/10/Corpse_flower_USBG_2.jpg/800px-Corpse_flower_USBG_2.jpg&w=600"
};
const catEmojis = { "Mammals":"🦁","Birds":"🦅","Insects":"🦋","Marine Life":"🌊","Reptiles & Amphibians":"🦎","Plants & Flowers":"🌺" };

function buildCategoryGrid() {
  const grid = document.getElementById('catGrid');
  if (!grid) return;
  const categories = Object.keys(catImgs);
  grid.innerHTML = categories.map(name => `
    <div class="cat-card" onclick="filterByCategory('${name}')">
      <div class="cat-bg" style="background-image:url('${catImgs[name]}');background-size:cover;background-position:center"></div>
      <div class="cat-ov"></div>
      <div class="cat-ct">
        <div class="cat-ico">${catEmojis[name]||'🐾'}</div>
        <div class="cat-nm">${name}</div>
        <div class="cat-cnt" id="catCount_${name.replace(/[^a-z]/gi,'_')}">Loading...</div>
      </div>
      <div class="cat-arr">→</div>
    </div>`).join('');
}

async function loadCategoryCounts() {
  try {
    const res = await API.get('/species/stats');
    res.byCat.forEach(({ _id, count }) => {
      const el = document.getElementById('catCount_' + (_id||'').replace(/[^a-z]/gi,'_'));
      if (el) el.textContent = count + ' species';
    });
  } catch (e) { /* silent */ }
}

// ============================================================
//  STATS BAR — from API
// ============================================================
let statsLoaded = false;
async function loadStatsBar() {
  try {
    const res = await API.get('/species/stats');
    const statMap = {};
    res.byStatus.forEach(s => { statMap[s._id] = s.count; });

    const targets = {
      '.st-num[data-key="threatened"]': Object.values(statMap).reduce((a,b)=>a+b,0),
      '.st-num[data-key="extinct"]':    statMap['Extinct'] || 0,
      '.st-num[data-key="critical"]':   statMap['Critically Endangered'] || 0,
      '.st-num[data-key="total"]':      res.total
    };
    Object.entries(targets).forEach(([sel, val]) => {
      const el = document.querySelector(sel);
      if (el) el.dataset.t = val;
    });
  } catch (e) { /* use defaults */ }
}

function animateStats() {
  if (statsAnimated) return;
  statsAnimated = true;
  document.querySelectorAll('.st-num[data-t]').forEach(el => {
    const target = parseInt(el.dataset.t);
    if (!target) return;
    const steps = 80, dur = 2400;
    let count = 0, cur = 0;
    const inc = target / steps;
    const t = setInterval(() => {
      count++; cur = Math.min(cur + inc, target);
      el.textContent = Math.floor(cur).toLocaleString();
      if (count >= steps) { el.textContent = target.toLocaleString(); clearInterval(t); }
    }, dur / steps);
  });
}

// ============================================================
//  SEARCH — queries the API
// ============================================================
function initSearch() {
  const input   = document.getElementById('searchIn');
  const results = document.getElementById('sResults');
  const sugg    = document.getElementById('sSugg');
  const pills   = ['Amur Leopard','Vaquita','Kakapo','Snow Leopard','Giant Panda','Blue Whale'];

  sugg.innerHTML = pills.map(s =>
    `<button class="s-pill" onclick="document.getElementById('searchIn').value='${s}';doSearch('${s}')">${s}</button>`
  ).join('');

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doSearch(input.value), 300);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) results.classList.remove('open');
  });
}

async function doSearch(q) {
  const results = document.getElementById('sResults');
  q = q.trim();
  if (!q) { results.classList.remove('open'); return; }

  try {
    const res = await API.get(`/species?search=${encodeURIComponent(q)}&limit=8`);
    if (!res.data.length) { results.classList.remove('open'); return; }
    results.innerHTML = res.data.map(s => `
      <div class="sr-item" onclick="openSpeciesModal('${s._id}');document.getElementById('sResults').classList.remove('open');document.getElementById('searchIn').value=''">
        <div class="sr-icon">${s.emoji||'🐾'}</div>
        <div><div class="sr-name">${s.name}</div><div class="sr-meta">${s.sci} · ${s.status}</div></div>
      </div>`).join('');
    results.classList.add('open');
  } catch (e) { results.classList.remove('open'); }
}

// ============================================================
//  TIMELINE (static data)
// ============================================================
const timelineData = [
  {year:1627,species:"Aurochs",emoji:"🐂"},
  {year:1681,species:"Dodo",emoji:"🦤"},
  {year:1768,species:"Steller's Sea Cow",emoji:"🐄"},
  {year:1844,species:"Great Auk",emoji:"🐧"},
  {year:1883,species:"Quagga",emoji:"🦓"},
  {year:1914,species:"Passenger Pigeon",emoji:"🕊️"},
  {year:1936,species:"Thylacine",emoji:"🐺"},
  {year:1952,species:"Caribbean Monk Seal",emoji:"🦭"},
  {year:1989,species:"Golden Toad",emoji:"🐸"},
  {year:2000,species:"Pyrenean Ibex",emoji:"🐐"},
  {year:2011,species:"Western Black Rhino",emoji:"🦏"},
  {year:2012,species:"Pinta Giant Tortoise",emoji:"🐢"},
  {year:2019,species:"Bramble Cay Melomys",emoji:"🐭"},
  {year:2023,species:"Yangtze Sturgeon (wild)",emoji:"🐟"}
];

function buildTimeline() {
  const track = document.getElementById('tlTrack');
  if (!track) return;
  track.innerHTML = timelineData.map(t => `
    <div class="tl-item">
      <div class="tl-card">
        <div class="tl-yr">${t.year}</div>
        <div class="tl-sp">${t.species}</div>
        <div class="tl-em">${t.emoji}</div>
      </div>
      <div class="tl-dot"></div>
    </div>`).join('');
}

// ============================================================
//  MARINE SECTION — from DB
// ============================================================
function buildMarine() {
  const grid = document.getElementById('marGrid');
  if (!grid) return;
  const marine = DB.filter(s => s.cat === 'Marine Life');
  if (!marine.length) {
    // Load separately if DB is empty
    API.get('/species?cat=Marine Life&limit=20').then(res => {
      renderMarineCards(res.data);
    }).catch(() => {});
    return;
  }
  renderMarineCards(marine);
}

function renderMarineCards(data) {
  const grid = document.getElementById('marGrid');
  if (!grid) return;
  grid.innerHTML = data.map(sp => `
    <div class="mar-card" onclick="openSpeciesModal('${sp._id}')">
      <div class="mar-ico">${sp.emoji||'🌊'}</div>
      <div class="mar-nm">${sp.name}</div>
      <div class="mar-sci">${sp.sci}</div>
      <div class="mar-desc">${(sp.desc||'').slice(0,140)}…</div>
    </div>`).join('');

  // Bubbles
  const scene = document.getElementById('marScene');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('div');
    b.className = 'bub';
    const s = Math.random() * 20 + 8;
    b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;bottom:0;animation-duration:${Math.random()*6+4}s;animation-delay:${Math.random()*4}s`;
    scene.appendChild(b);
  }
}

// ============================================================
//  PLANTS (static data)
// ============================================================
const plantsDB = [
  {name:"Corpse Flower",sci:"Amorphophallus titanum",bloom:"Every 7-10 years",region:"Sumatra, Indonesia",rarity:"Extremely Rare",desc:"Produces the world's largest unbranched flower structure, reaching 10 feet tall. Emits a powerful rotting-flesh odor to attract pollinators.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/1/10/Corpse_flower_USBG_2.jpg/800px-Corpse_flower_USBG_2.jpg&w=600"},
  {name:"Ghost Orchid",sci:"Dendrophylax lindenii",bloom:"June-August",region:"Florida, Cuba",rarity:"Critically Rare",desc:"An ethereal epiphytic orchid with no leaves — photosynthesis occurs through its roots. Pollinated exclusively by the giant sphinx moth.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/6/68/GhostOrchid2_%282%29.jpg/800px-GhostOrchid2_%282%29.jpg&w=600"},
  {name:"Jade Vine",sci:"Strongylodon macrobotrys",bloom:"March-May",region:"Philippines",rarity:"Endangered",desc:"Produces spectacular claw-shaped turquoise flowers in cascading clusters up to 3 meters long. Pollinated by bats in the wild.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/d/d4/JadeVine.jpg/800px-JadeVine.jpg&w=600"},
  {name:"Middlemist Red",sci:"Middlemist camellia",bloom:"February-March",region:"China (originally), UK/NZ",rarity:"Rarest Flower",desc:"Only two known plants exist — one in London and one in New Zealand. Brought from China in 1804, now extinct in its homeland.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/6/60/Middlemist_camellia.jpg/800px-Middlemist_camellia.jpg&w=600"},
  {name:"Rafflesia",sci:"Rafflesia arnoldii",bloom:"Unpredictable",region:"Borneo, Sumatra",rarity:"Rare",desc:"Produces the world's largest single flower, up to 3 feet across and weighing 24 pounds. A parasitic plant with no roots, stems, or leaves.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rafflesia_arnoldii.JPG/800px-Rafflesia_arnoldii.JPG&w=600"},
  {name:"Venus Flytrap",sci:"Dionaea muscipula",bloom:"May-June",region:"Carolinas, USA",rarity:"Vulnerable",desc:"One of the few plants capable of rapid movement, snapping shut on prey in under a second. Native to a 90-mile radius around Wilmington, NC.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/1/14/Venus_Flytrap_showing_trigger_hairs.jpg/800px-Venus_Flytrap_showing_trigger_hairs.jpg&w=600"},
  {name:"Dragon Blood Tree",sci:"Dracaena cinnabari",bloom:"February",region:"Socotra, Yemen",rarity:"Vulnerable",desc:"An alien-looking umbrella-shaped tree that 'bleeds' red sap when cut. Found only on the remote island of Socotra, can live 600+ years.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Socotra_dragon_tree.JPG/800px-Socotra_dragon_tree.JPG&w=600"},
  {name:"Western Underground Orchid",sci:"Rhizanthella gardneri",bloom:"May-June",region:"Western Australia",rarity:"Critically Endangered",desc:"Spends its entire life underground, including flowering. Depends on a fungus that connects it to broom bush roots. Fewer than 50 plants remain.",img:"https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Rhizanthella_gardneri.jpg/800px-Rhizanthella_gardneri.jpg&w=600"}
];

function buildPlants() {
  const grid = document.getElementById('plGrid');
  if (!grid) return;
  grid.innerHTML = plantsDB.map(p => `
    <div class="pl-card">
      <div class="pl-img"><img src="${p.img}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover"></div>
      <div class="pl-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div><div class="pl-nm">${p.name}</div><div class="pl-sci">${p.sci}</div></div>
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(122,45,90,.12);color:#7a2d5a">${p.rarity}</span>
        </div>
        <div class="pl-meta">🗓️ Blooms: ${p.bloom} · 📍 ${p.region}</div>
        <p class="pl-desc">${p.desc}</p>
      </div>
    </div>`).join('');
}

// ============================================================
//  CHARTS — from API stats
// ============================================================
async function buildCharts() {
  const grid = document.getElementById('chGrid');
  if (!grid) return;

  try {
    const res = await API.get('/species/stats');
    const catCounts  = {};
    const stCounts   = {};
    res.byCat.forEach(({_id,count}) => { if(_id) catCounts[_id]  = count; });
    res.byStatus.forEach(({_id,count}) => { if(_id) stCounts[_id] = count; });
    const total = res.total;

    const catColors  = {'Mammals':'linear-gradient(90deg,#2d5a3d,#4a9a6a)','Birds':'linear-gradient(90deg,#1a6b5a,#4ab89a)','Insects':'linear-gradient(90deg,#8B6914,#e4a82e)','Marine Life':'linear-gradient(90deg,#0a4d6e,#1a9ebe)','Reptiles & Amphibians':'linear-gradient(90deg,#3a6a1a,#6aaa3a)','Plants & Flowers':'linear-gradient(90deg,#7a2d5a,#c45a9a)'};
    const catEmoji2  = {'Mammals':'🦁','Birds':'🦅','Insects':'🦋','Marine Life':'🌊','Reptiles & Amphibians':'🦎','Plants & Flowers':'🌺'};
    const stSolid    = {'Critically Endangered':'#ff6b35','Endangered':'#f5c323','Extinct':'#dc3545','Vulnerable':'#9b59b6','Rare':'#1a9ebe'};
    const stEmoji2   = {'Critically Endangered':'🔴','Endangered':'🟠','Extinct':'⚫','Vulnerable':'🟣','Rare':'🔵'};
    const maxCat     = Math.max(...Object.values(catCounts), 1);
    const threats    = [
      {name:'Habitat Loss & Deforestation',pct:85,color:'linear-gradient(90deg,#8a0018,#e85d26)'},
      {name:'Climate Change',pct:71,color:'linear-gradient(90deg,#c47a00,#f5c323)'},
      {name:'Illegal Wildlife Trade',pct:62,color:'linear-gradient(90deg,#6a1a9a,#c45a9a)'},
      {name:'Pollution & Toxins',pct:54,color:'linear-gradient(90deg,#0a4d6e,#1a9ebe)'},
      {name:'Invasive Species',pct:43,color:'linear-gradient(90deg,#2d5a3d,#4ab89a)'},
      {name:'Overexploitation',pct:38,color:'linear-gradient(90deg,#3a6a1a,#6aaa3a)'}
    ];

    // Build donut
    let offset = 0;
    const circ = 2 * Math.PI * 48;
    const statusArr = Object.entries(stCounts).sort((a,b)=>b[1]-a[1]);
    const segments  = statusArr.map(([k,v]) => {
      const dash = (v/total)*circ;
      const seg  = `<circle cx="60" cy="60" r="48" fill="none" stroke="${stSolid[k]||'#888'}" stroke-width="14"
        stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)">
        <title>${k}: ${v}</title></circle>`;
      offset += dash; return seg;
    }).join('');

    grid.innerHTML = `
    <div style="grid-column:1/-1">
      <div class="stat-highlight">
        <div class="stat-hl" style="background:linear-gradient(135deg,#8a0018,#e85d26);color:#fff">
          <div><div class="stat-hl-val">${stCounts['Critically Endangered']||0}</div><div class="stat-hl-lbl">Critically Endangered</div></div>
          <span class="stat-hl-trend" style="background:rgba(255,255,255,.2);color:#fff">⚠️ Urgent Action Needed</span>
          <div class="stat-hl-icon">🔴</div>
        </div>
        <div class="stat-hl" style="background:linear-gradient(135deg,#6a1a9a,#c45a9a);color:#fff">
          <div><div class="stat-hl-val">${stCounts['Extinct']||0}</div><div class="stat-hl-lbl">Species Extinct</div></div>
          <span class="stat-hl-trend" style="background:rgba(255,255,255,.2);color:#fff">⚫ Gone Forever</span>
          <div class="stat-hl-icon">💀</div>
        </div>
        <div class="stat-hl" style="background:linear-gradient(135deg,#0a4d6e,#1a9ebe);color:#fff">
          <div><div class="stat-hl-val">${total}</div><div class="stat-hl-lbl">Species Tracked</div></div>
          <span class="stat-hl-trend" style="background:rgba(255,255,255,.2);color:#fff">📊 In Database</span>
          <div class="stat-hl-icon">🌍</div>
        </div>
        <div class="stat-hl" style="background:linear-gradient(135deg,#2d5a3d,#4ab89a);color:#fff">
          <div><div class="stat-hl-val">${Object.keys(catCounts).length}</div><div class="stat-hl-lbl">Categories</div></div>
          <span class="stat-hl-trend" style="background:rgba(255,255,255,.2);color:#fff">🌿 Across All Habitats</span>
          <div class="stat-hl-icon">🦁</div>
        </div>
      </div>
    </div>
    <div class="ch-card">
      <div class="ch-card-hdr"><div><div class="ch-title">🐾 Species by Category</div><div class="ch-subtitle">Distribution across ${Object.keys(catCounts).length} groups</div></div></div>
      ${Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
      <div class="ch-bar-row">
        <div class="ch-bar-label">${catEmoji2[k]||'•'} ${k}</div>
        <div class="ch-bar-track"><div class="ch-bar-fill" data-w="${(v/maxCat)*100}" style="background:${catColors[k]||'#888'}"></div></div>
        <div class="ch-bar-count">${v}</div>
      </div>`).join('')}
    </div>
    <div class="ch-card">
      <div class="ch-card-hdr"><div><div class="ch-title">🚨 Conservation Status</div><div class="ch-subtitle">Threat level breakdown</div></div></div>
      <div class="donut-wrap">
        <svg class="donut-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="14"/>
          ${segments}
          <text x="60" y="56" text-anchor="middle" font-size="18" font-weight="800" fill="rgba(255,255,255,.9)">${total}</text>
          <text x="60" y="70" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.4)">SPECIES</text>
        </svg>
        <div class="donut-legend">
          ${statusArr.map(([k,v])=>`
          <div class="donut-item">
            <div class="donut-dot" style="background:${stSolid[k]||'#888'}"></div>
            <span>${stEmoji2[k]||''} ${k}</span>
            <span class="donut-pct">${v}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="ch-card" style="grid-column:1/-1">
      <div class="ch-card-hdr"><div><div class="ch-title">⚡ Primary Threats to Biodiversity</div><div class="ch-subtitle">% of endangered species affected globally (IUCN data)</div></div></div>
      <div class="threat-list">
        ${threats.map(t=>`
        <div class="threat-item">
          <div class="threat-top"><span class="threat-name">${t.name}</span><span class="threat-pct">${t.pct}%</span></div>
          <div class="threat-bar"><div class="threat-fill" data-w="${t.pct}" style="background:${t.color}"></div></div>
        </div>`).join('')}
      </div>
    </div>`;
  } catch (e) {
    grid.innerHTML = `<div style="color:rgba(255,255,255,.5);text-align:center;padding:40px">Could not load statistics</div>`;
  }
}

// ============================================================
//  NEWS (static)
// ============================================================
const newsData = [
  {title:"Historic Coral Reef Recovery Discovered in Western Pacific",tag:"Marine",date:"December 2025",excerpt:"Scientists have found significant coral regrowth in previously bleached areas, suggesting some reefs may be more resilient than expected."},
  {title:"Snow Leopard Population Survey Reveals Promising Numbers",tag:"Conservation",date:"November 2025",excerpt:"New camera trap data from across 12 Central Asian countries shows snow leopard populations may be higher than previous estimates."},
  {title:"Amazon Rainforest Deforestation Drops to 5-Year Low",tag:"Habitat",date:"October 2025",excerpt:"Satellite monitoring confirms a significant reduction in Amazon deforestation, offering hope for thousands of endangered species."},
  {title:"De-Extinction Breakthrough: Mammoth Cells Show Viability",tag:"Science",date:"September 2025",excerpt:"Researchers successfully reprogrammed woolly mammoth DNA in elephant stem cells, marking a major step toward de-extinction."},
  {title:"New Species of Deep-Sea Fish Discovered Near Mariana Trench",tag:"Discovery",date:"August 2025",excerpt:"Marine biologists catalog a luminescent species at record depths, highlighting how much of ocean biodiversity remains unknown."},
  {title:"Global Treaty Pledges 30% of Earth Protected by 2030",tag:"Policy",date:"July 2025",excerpt:"196 nations reaffirm commitment to the Kunming-Montreal Global Biodiversity Framework to halt species loss worldwide."}
];

function buildNews() {
  const grid = document.getElementById('nwGrid');
  if (!grid) return;
  const tagColors = {Marine:'#0a4d6e',Conservation:'#2d5a3d',Habitat:'#8B6914',Science:'#7a2d5a',Discovery:'#1a7a9e',Policy:'#555'};
  grid.innerHTML = newsData.map(n => `
    <div class="nw-card" style="padding:22px">
      <div class="nw-tag" style="background:${tagColors[n.tag]||'#555'}22;color:${tagColors[n.tag]||'#555'};border:1px solid ${tagColors[n.tag]||'#555'}44">${n.tag}</div>
      <div class="nw-title">${n.title}</div>
      <div class="nw-date">📅 ${n.date}</div>
      <p class="nw-exc">${n.excerpt}</p>
    </div>`).join('');
}

// ============================================================
//  MAP
// ============================================================
const hotspots = [
  {name:"Amazon Basin",loc:[-3.4,-60.0],species:427,risk:"Extreme"},
  {name:"Borneo",loc:[1.0,114.0],species:312,risk:"Extreme"},
  {name:"Madagascar",loc:[-18.9,47.5],species:289,risk:"Extreme"},
  {name:"Coral Triangle",loc:[-2.0,125.0],species:576,risk:"High"},
  {name:"Western Ghats",loc:[10.0,76.5],species:198,risk:"High"},
  {name:"Congo Basin",loc:[-0.5,23.0],species:254,risk:"Extreme"},
  {name:"Great Barrier Reef",loc:[-18.3,147.7],species:389,risk:"High"},
  {name:"Philippines",loc:[12.0,122.0],species:243,risk:"Extreme"}
];

function initMap() {
  if (!document.getElementById('gmap')) return;
  try {
    const map = L.map('gmap').setView([10,20], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:18 }).addTo(map);
    const rc = {Extreme:'#dc3545',High:'#f5a623',Moderate:'#28a745'};
    hotspots.forEach(h => {
      L.circleMarker(h.loc, { radius:Math.sqrt(h.species/3)+4, color:rc[h.risk]||'#888', fillColor:rc[h.risk]||'#888', fillOpacity:.45, weight:2 })
       .addTo(map)
       .bindPopup(`<strong>${h.name}</strong><br>${h.species} endangered species<br>Risk: <b style="color:${rc[h.risk]}">${h.risk}</b>`);
    });
    DB.forEach(sp => {
      if (!sp.loc || !sp.loc[0]) return;
      const m = L.marker(sp.loc).addTo(map);
      m.bindPopup(`<div style="text-align:center"><div style="font-size:24px">${sp.emoji||'🐾'}</div><strong>${sp.name}</strong><br><em>${sp.sci}</em><br><span style="color:${statusColor(sp.status)};font-weight:700">${sp.status}</span></div>`);
      m.on('click', () => openSpeciesModal(sp._id));
    });
  } catch (e) { console.warn('Map error', e); }
}

// ============================================================
//  NAV
// ============================================================
function initNav() {
  window.addEventListener('scroll', () => {
    document.getElementById('navEl').classList.toggle('scrolled', window.scrollY > 60);
  });
  document.getElementById('hamBtn').addEventListener('click', () => {
    document.getElementById('nLinks').classList.toggle('mob');
  });
  document.getElementById('soundBtn').addEventListener('click', () => showToast('Ambient sound coming soon!','info'));
  document.getElementById('themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    document.getElementById('themeBtn').textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
  });
}

// ============================================================
//  REVEAL + STATS TRIGGER ON SCROLL
// ============================================================
function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('vis'); });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) {
    const sio = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { animateStats(); sio.unobserve(e.target); } });
    }, { threshold: 0.3 });
    sio.observe(statsBar);
  }

  const statsSec = document.getElementById('statistics');
  if (statsSec) {
    let chartsAnimated = false;
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !chartsAnimated) {
          chartsAnimated = true;
          document.querySelectorAll('.ch-bar-fill[data-w],.threat-fill[data-w]').forEach(el => {
            el.style.width = el.dataset.w + '%';
          });
          cio.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    cio.observe(statsSec);
  }
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'✅'}</span><span class="toast-msg">${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3300);
}

// ============================================================
//  LEAVES & BIRDS
// ============================================================
function spawnLeaves() {
  const c = document.getElementById('flLeaves');
  if (!c) return;
  ['🍃','🌿','🍂','🍁'].forEach((leaf, i) => {
    for (let j = 0; j < 3; j++) {
      const l = document.createElement('div');
      l.className = 'fl-leaf';
      l.textContent = leaf;
      l.style.cssText = `left:${Math.random()*100}%;font-size:${Math.random()*14+8}px;animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*8}s`;
      c.appendChild(l);
    }
  });
}

function spawnHeroBirds() {
  const c = document.getElementById('heroBirds');
  if (!c) return;
  for (let i = 0; i < 5; i++) {
    const b = document.createElement('div');
    b.className = 'hbird'; b.innerHTML = '🐦';
    b.style.cssText = `top:${Math.random()*60}%;font-size:${Math.random()*8+6}px;animation-duration:${Math.random()*18+12}s;animation-delay:${Math.random()*10}s`;
    c.appendChild(b);
  }
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => document.getElementById('loader').classList.add('gone'), 2400);

  initNav();
  initSearch();
  initReveal();
  spawnLeaves();
  spawnHeroBirds();
  buildCategoryGrid();
  buildFilterBar();
  buildTimeline();
  buildPlants();
  buildNews();

  // Load from API
  await loadSpecies('All');
  await loadCategoryCounts();
  await loadStatsBar();
  await buildCharts();

  setTimeout(() => buildMarine(), 200);
  setTimeout(() => initMap(), 600);
});
