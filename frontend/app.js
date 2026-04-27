// ── CONFIG ────────────────────────────────────────────────────────────────────
// Change API_BASE to your backend URL when deploying frontend separately
// e.g. 'https://your-api.up.railway.app'
var API_BASE = window.NEWSINTEL_API_URL || '';

// ── STATE ─────────────────────────────────────────────────────────────────────
var S = { topic: null, bias: 'all', page: 1, totalPages: 1, selectedId: null, stockRegion: 'global' };

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function isMobile() { return window.innerWidth <= 768; }
function toast(msg, cls) {
  var el = document.createElement('div');
  el.className = 'toast ' + (cls || '');
  el.textContent = msg;
  document.getElementById('tc').appendChild(el);
  setTimeout(function(){ el.remove(); }, 3500);
}
function fmtDate(iso) {
  if (!iso) return '';
  try { var d = new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch(e){ return ''; }
}
function fmtShort(iso) {
  if (!iso) return '';
  try { var d = new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); } catch(e){ return ''; }
}
function biasCSS(lbl) {
  var m = {'left':'bl','center-left':'bcl','center':'bc','center-right':'bcr','right':'br'};
  return m[lbl] || '';
}
function sentColor(v) {
  if (v > 0.15) return 'var(--center)';
  if (v < -0.15) return 'var(--right)';
  return 'var(--muted)';
}

// ── API ───────────────────────────────────────────────────────────────────────
var S = { 
  topic: null, bias: 'all', page: 1, totalPages: 1, 
  token: localStorage.getItem('ni_token'),
  user: null,
  authMode: 'login'
};

async function apiFetch(path) {
  try {
    var headers = {};
    if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
    else if (window.NEWSINTEL_API_KEY) headers['X-API-Key'] = window.NEWSINTEL_API_KEY;
    
    var r = await fetch(API_BASE + path, { headers: headers });
    if (r.status === 401) { 
      console.warn('Unauthorized', path); 
      if (S.token) { logout(); toast('Session expired — please login again', 'err'); }
      return null; 
    }
    if (!r.ok) { console.warn('API ' + r.status, path); return null; }
    return await r.json();
  } catch(e) { console.error('fetch', path, e); return null; }
}
async function apiPost(path, body) {
  try {
    var headers = { 'Content-Type': 'application/json' };
    if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
    else if (window.NEWSINTEL_API_KEY) headers['X-API-Key'] = window.NEWSINTEL_API_KEY;
    
    var opts = { method: 'POST', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    
    var r = await fetch(API_BASE + path, opts);
    if (r.status === 401) return { error: 'unauthorized' };
    if (r.status === 403) return { error: 'forbidden' };
    if (!r.ok) {
        try {
            var err = await r.json();
            return { error: 'api_error', detail: err.detail, errors: err.errors };
        } catch(e) {
            return null;
        }
    }
    return await r.json();
  } catch(e) { console.error('post', path, e); return null; }
}

// ── DRAWER ────────────────────────────────────────────────────────────────────
function openDrawer() {
  document.getElementById('drawer').classList.add('on');
  document.getElementById('overlay').classList.add('on');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('overlay').classList.remove('on');
}
function closeDModal() { document.getElementById('dmodal').classList.remove('on'); }

// ── SUMMARY ───────────────────────────────────────────────────────────────────
async function loadSummary() {
  if (!S.token) {
    document.getElementById('stats').innerHTML = '<div class="sc" style="grid-column:1/-1"><div class="sl">Access Restricted</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--muted);margin-top:.3rem">Login to view insights — click <strong style="color:var(--accent);cursor:pointer" onclick="handleAuth()">Login</strong></div></div>';
    return;
  }
  var data = await apiFetch('/insights/summary');
  if (!data) {
    document.getElementById('stats').innerHTML = '<div class="sc" style="grid-column:1/-1"><div class="sl">Error</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--muted);margin-top:.3rem">Error loading data.</div></div>';
    return;
  }
  var total = data.total_articles || 0;
  var proc = data.total_processed || 0;
  var topics = (data.topics || []).length;
  var sent = data.avg_sentiment || 0;
  var bias = data.bias_distribution || {};
  var cpct = proc > 0 ? Math.round((bias.center || 0) / proc * 100) : 0;
  var sentcol = sent >= 0 ? 'var(--center)' : 'var(--right)';
  var sentlbl = sent >= 0 ? 'Positive lean' : 'Negative lean';
  var sentSign = sent >= 0 ? '+' : '';

  document.getElementById('stats').innerHTML =
    '<div class="sc"><div class="sl">Total Articles</div><div class="sv">' + total.toLocaleString() + '</div><div class="ss">All sources</div></div>' +
    '<div class="sc"><div class="sl">Processed</div><div class="sv">' + proc.toLocaleString() + '</div><div class="ss">' + (total>0?Math.round(proc/total*100):0) + '% analysed</div></div>' +
    '<div class="sc"><div class="sl">Topics</div><div class="sv">' + topics + '</div><div class="ss">Categories</div></div>' +
    '<div class="sc"><div class="sl">Avg Sentiment</div><div class="sv" style="color:' + sentcol + '">' + sentSign + sent.toFixed(2) + '</div><div class="ss">' + sentlbl + '</div></div>' +
    '<div class="sc"><div class="sl">Center Bias %</div><div class="sv">' + cpct + '%</div><div class="ss">L:' + (bias.left||0) + ' R:' + (bias.right||0) + '</div></div>';

  var thtml = '<div class="tr ' + (!S.topic ? 'on' : '') + '" onclick="setTopic(null,this)"><span class="tn">All</span><span class="tbg">' + total + '</span></div>';
  (data.topics || []).forEach(function(t) {
    thtml += '<div class="tr ' + (S.topic===t.topic?'on':'') + '" onclick="setTopic(\'' + esc(t.topic) + '\',this)"><span class="tn">' + esc(t.topic) + '</span><span class="tbg">' + t.article_count + '</span></div>';
  });
  document.getElementById('topicsList').innerHTML = thtml;
  document.getElementById('drawerContent').innerHTML = '<div class="sb-sec"><div class="sb-title">Topics</div>' + thtml + '</div>';

  var tick = '';
  (data.topics || []).forEach(function(t) {
    var bc = (t.avg_bias_score || 0) < -0.15 ? 'var(--left)' : (t.avg_bias_score || 0) > 0.15 ? 'var(--right)' : 'var(--center)';
    tick += '<span class="ti">' + t.topic.toUpperCase() + ' <b>' + t.article_count + '</b> art · Bias: <b style="color:' + bc + '">' + (t.bias_label||'center') + '</b></span>';
  });
  if (tick) document.getElementById('ticker').innerHTML = tick + tick;
}

// ── TRENDING ──────────────────────────────────────────────────────────────────
async function loadTrending() {
  var data = await apiFetch('/trending?hours=24&top_n=12');
  var bar = document.getElementById('tbar');
  if (!data || !data.trending || !data.trending.length) {
    bar.innerHTML = '<span class="tb-lbl">🔥 Trending</span><span style="font-family:var(--font-mono);font-size:.65rem;color:var(--muted)">No trends yet — refresh to load articles</span>';
    return;
  }
  var h = '<span class="tb-lbl">🔥 Trending</span>';
  data.trending.forEach(function(t, i) {
    var hot = t.trend_velocity > 2 ? 'hot' : '';
    var sentArrow = t.avg_sentiment > 0.2 ? '<span style="color:var(--center);font-family:var(--font-mono);font-size:.58rem">▲</span>' : t.avg_sentiment < -0.2 ? '<span style="color:var(--right);font-family:var(--font-mono);font-size:.58rem">▼</span>' : '';
    h += '<div class="tc ' + hot + '" onclick="setTopic(\'' + esc(t.topic) + '\',null)" title="' + t.article_count + ' articles · ' + t.source_count + ' sources">' +
      '<span style="font-family:var(--font-mono);font-size:.58rem;color:var(--muted)">' + (i+1) + '</span>' +
      '<span class="tc-name">' + esc(t.topic) + '</span>' +
      '<span class="tc-cnt">' + t.article_count + ' · ' + t.source_count + 'src</span>' +
      sentArrow +
      (t.is_contested ? '<span class="tbadge hot">contested</span>' : '') +
      (t.trend_velocity > 2 ? '<span class="tbadge">↑ rising</span>' : '') +
      '</div>';
  });
  bar.innerHTML = h;
}

// ── STOCKS ────────────────────────────────────────────────────────────────────
function buildRsel(cur) {
  var opts = [['global','🌍 Global'],['west','🇺🇸 US/UK'],['europe','🇪🇺 Europe'],['middle_east','🌙 Middle East'],['india','🇮🇳 India'],['southeast_asia','🌏 SE Asia'],['east_asia','🀄 East Asia'],['africa','🌍 Africa'],['latin_america','🌎 LatAm']];
  var h = '<select class="rsel" id="rsel" onchange="changeStockRegion(this.value)">';
  opts.forEach(function(o){ h += '<option value="' + o[0] + '"' + (o[0]===cur?' selected':'') + '>' + o[1] + '</option>'; });
  return h + '</select>';
}
async function loadStocks(region) {
  region = region || S.stockRegion || 'global';
  S.stockRegion = region;
  var s = document.getElementById('rsel');
  if (s) s.value = region;
  var data = await apiFetch('/stocks?region=' + region);
  var bar = document.getElementById('sbar');
  var pre = '<span class="sb-lbl">📈 Markets</span>';
  if (!data || data.status === 'unavailable' || !data.indices || !data.indices.length) {
    bar.innerHTML = pre + '<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--muted)">Market closed or unavailable</span>' + buildRsel(region);
    return;
  }
  var chips = '';
  data.indices.slice(0,10).forEach(function(idx) {
    var arr = idx.direction==='up' ? '▲' : idx.direction==='down' ? '▼' : '─';
    chips += '<div class="schip" title="' + esc(idx.ticker) + '">' +
      '<span class="sname">' + esc(idx.name) + '</span>' +
      '<span class="sprice">' + (idx.price||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + '</span>' +
      '<span class="schg ' + (idx.direction||'flat') + '">' + esc(idx.change_fmt) + '</span>' +
      '<span class="sarr ' + (idx.direction||'flat') + '">' + arr + '</span></div>';
  });
  var mood = data.market_mood || 'mixed';
  var moodCls = mood === 'bullish' ? 'bull' : mood === 'bearish' ? 'bear' : 'mixed';
  bar.innerHTML = pre + chips + '<span class="mmood ' + moodCls + '">' + mood.toUpperCase() + '</span>' + buildRsel(region);
}
function changeStockRegion(r) { loadStocks(r); }

function mapCoordsToRegion(lat, lon) {
    if (lat > 35 && lon > -25 && lon < 45) return 'europe';
    if (lat > 25 && lon > -125 && lon < -60) return 'west';
    if (lat > 5 && lat < 35 && lon > 60 && lon < 95) return 'india';
    if (lat > -10 && lat < 30 && lon > 95 && lon < 150) return 'southeast_asia';
    if (lat > 20 && lat < 50 && lon > 100 && lon < 150) return 'east_asia';
    if (lat > 15 && lat < 40 && lon > 35 && lon < 60) return 'middle_east';
    if (lat < 35 && lat > -35 && lon > -20 && lon < 55) return 'africa';
    if (lat < 30 && lon > -110 && lon < -30) return 'latin_america';
    return 'global';
}
function initStocks() {
  if (navigator.geolocation && (!S.stockRegion || S.stockRegion === 'global')) {
    navigator.geolocation.getCurrentPosition(function(pos) {
      var r = mapCoordsToRegion(pos.coords.latitude, pos.coords.longitude);
      loadStocks(r);
    }, function(err) {
      loadStocks('global');
    }, { timeout: 5000 });
  } else {
    loadStocks(S.stockRegion || 'global');
  }
}

// ── ARTICLES ──────────────────────────────────────────────────────────────────
async function loadArticles() {
  var list = document.getElementById('articleList');
  var sk = '';
  for (var i=0;i<6;i++) sk += '<div class="skcard"><div class="sk skl" style="width:45%"></div><div class="sk skl" style="width:80%;height:15px"></div><div class="sk skl" style="width:96%"></div><div class="sk skl" style="width:65%"></div></div>';
  list.innerHTML = sk;

  var url = '/articles?page=' + S.page + '&page_size=15';
  if (S.topic) url += '&topic=' + encodeURIComponent(S.topic);
  if (S.bias && S.bias !== 'all') url += '&bias_label=' + encodeURIComponent(S.bias);

  var data = await apiFetch(url);
  if (!data) { list.innerHTML = '<div class="empty"><p>Could not load articles.<br>Check API connection.</p></div>'; return; }

  S.totalPages = data.pages || 1;
  document.getElementById('feedTitle').textContent = S.topic ? (S.topic.charAt(0).toUpperCase() + S.topic.slice(1)) : 'All Sources';

  if (!data.articles || !data.articles.length) {
    list.innerHTML = '<div class="empty"><p>No articles found.<br>Try <strong>↻ Refresh</strong> or change filters.</p></div>';
  } else {
    var h = '';
    data.articles.forEach(function(a, i) { h += buildCard(a, i); });
    list.innerHTML = h;
  }

  var pag = document.getElementById('pag');
  if (S.totalPages > 1) {
    pag.style.display = 'flex';
    document.getElementById('pinfo').textContent = 'Page ' + S.page + ' of ' + S.totalPages;
    document.getElementById('prevBtn').disabled = S.page <= 1;
    document.getElementById('nextBtn').disabled = S.page >= S.totalPages;
  } else {
    pag.style.display = 'none';
  }
}

function buildCard(a, idx) {
  var bc = biasCSS(a.bias_label);
  var biasHtml = a.bias_label ? '<span class="cbias ' + bc + '">' + esc(a.bias_label) + '</span>' : '';
  var topicHtml = a.topic ? '<span class="ctopic">' + esc(a.topic) + '</span>' : '';
  var sp = a.sentiment_score != null ? Math.round(((a.sentiment_score+1)/2)*100) : 50;
  var sc = a.sentiment_score != null ? sentColor(a.sentiment_score) : 'var(--muted)';
  var sel = S.selectedId === a.id ? 'sel' : '';
  return '<div class="card ' + sel + '" style="animation-delay:' + (idx*0.04) + 's" onclick="selectArticle(' + a.id + ')" data-id="' + a.id + '">' +
    '<div class="cmeta"><span class="csrc">' + esc(a.source_name) + '</span>' + topicHtml + biasHtml + '</div>' +
    '<div class="ctitle">' + esc(a.title) + '</div>' +
    (a.description ? '<div class="cdesc">' + esc(a.description) + '</div>' : '') +
    '<div class="cfooter"><span class="cdate">' + fmtShort(a.published_at) + '</span>' +
    '<div class="sentbar"><div class="sentfill" style="width:' + sp + '%;background:' + sc + '"></div></div>' +
    '</div></div>';
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
async function selectArticle(id) {
  S.selectedId = id;
  document.querySelectorAll('.card').forEach(function(el) {
    el.classList.toggle('sel', parseInt(el.getAttribute('data-id')) === id);
  });

  var target = isMobile() ? document.getElementById('dmodalBody') : document.getElementById('detailEl');
  if (isMobile()) document.getElementById('dmodal').classList.add('on');
  target.innerHTML = '<div style="padding:1.5rem"><div class="sk" style="height:180px;display:block"></div></div>';

  var a = await apiFetch('/articles/' + id);
  if (!a) { target.innerHTML = '<div class="de"><div class="de-icon">✗</div><p class="de-txt">Failed to load</p></div>'; return; }

  var bp = a.bias_score != null ? ((a.bias_score+1)/2*100) : 50;
  var sp = a.sentiment_score != null ? Math.round(((a.sentiment_score+1)/2)*100) : 50;
  var sc = a.sentiment_score != null ? sentColor(a.sentiment_score) : 'var(--muted)';
  var ss = a.sentiment_score >= 0 ? '+' : '';
  var ents = a.entities || {};
  var kws = a.keywords || [];

  var h = '<div class="dbody">';
  h += '<div class="d-src">' + esc(a.source_name) + ' &nbsp;·&nbsp; ' + fmtDate(a.published_at) + (a.author ? ' &nbsp;·&nbsp; ' + esc(a.author) : '') + '</div>';
  h += '<div class="d-ttl">' + esc(a.title) + '</div>';
  if (a.description) h += '<div class="d-desc">' + esc(a.description) + '</div>';

  h += '<div class="ablock"><div class="albl">Political Bias</div>' +
    '<div class="bmeter"><div class="bneedle" style="left:' + bp + '%"></div></div>' +
    '<div class="baxis"><span>Left</span><span>Center</span><span>Right</span></div>' +
    '<div class="bdetail">Label: <span>' + esc(a.bias_label || 'unknown') + '</span> &nbsp;·&nbsp; Score: <span>' + (a.bias_score != null ? a.bias_score.toFixed(2) : 'N/A') + '</span></div></div>';

  h += '<div class="ablock"><div class="albl">Sentiment</div>' +
    '<div class="gauge"><span class="gend">−</span>' +
    '<div class="gbar"><div class="gfill" style="width:' + sp + '%;background:' + sc + '"></div></div>' +
    '<span class="gend">+</span><span class="gval" style="color:' + sc + '">' + ss + (a.sentiment_score != null ? a.sentiment_score.toFixed(2) : 'N/A') + '</span></div></div>';

  var hasEnts = (ents.people && ents.people.length) || (ents.organizations && ents.organizations.length) || (ents.places && ents.places.length);
  if (hasEnts) {
    h += '<div class="ablock"><div class="albl">Named Entities</div>';
    if (ents.people && ents.people.length) {
      h += '<div class="eg"><div class="el">People</div><div class="tags">';
      ents.people.forEach(function(e){ h += '<span class="tag">' + esc(e) + '</span>'; });
      h += '</div></div>';
    }
    if (ents.organizations && ents.organizations.length) {
      h += '<div class="eg"><div class="el">Organizations</div><div class="tags">';
      ents.organizations.forEach(function(e){ h += '<span class="tag">' + esc(e) + '</span>'; });
      h += '</div></div>';
    }
    if (ents.places && ents.places.length) {
      h += '<div class="eg"><div class="el">Places</div><div class="tags">';
      ents.places.forEach(function(e){ h += '<span class="tag">' + esc(e) + '</span>'; });
      h += '</div></div>';
    }
    h += '</div>';
  }

  if (kws.length) {
    h += '<div class="ablock"><div class="albl">Keywords</div><div class="kws">';
    kws.forEach(function(k){ h += '<span class="kw">' + esc(k) + '</span>'; });
    h += '</div></div>';
  }

  h += '<div class="cnote"><strong>⚠ Note:</strong> Bias and sentiment are heuristic estimates — not absolute truth. Cross-reference multiple sources for informed conclusions.</div>';
  h += '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" class="rlink">Read full article →</a>';
  h += '</div>';
  target.innerHTML = h;
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function setTopic(topic, el) {
  S.topic = topic; S.page = 1;
  document.querySelectorAll('.tr').forEach(function(r){ r.classList.remove('on'); });
  if (el) el.classList.add('on');
  closeDrawer();
  loadArticles();
}
function setBiasFilter(bias, el) {
  S.bias = bias; S.page = 1;
  document.querySelectorAll('.bbtn').forEach(function(b){ b.classList.remove('on'); });
  if (el) el.classList.add('on');
  loadArticles();
}
function changePage(dir) {
  S.page = Math.max(1, Math.min(S.totalPages, S.page + dir));
  loadArticles();
  document.getElementById('feedEl').scrollTo(0, 0);
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────
async function triggerPipeline() {
  if (!S.token) {
    handleAuth();
    toast('Login required to trigger pipeline', 'err');
    return;
  }
  var btn = document.getElementById('refreshBtn');
  btn.disabled = true; btn.textContent = '↻ Fetching…';
  document.getElementById('statusTxt').textContent = 'Ingesting…';
  toast('Ingesting news from all sources…', 'info');
  var data = await apiPost('/admin/pipeline');
  if (data && data.error === 'unauthorized') {
    handleAuth();
    toast('Login required', 'err');
  } else if (data && data.error === 'forbidden') {
    toast('Permission denied — admin role required', 'err');
  } else if (data) {
    var saved = (data.ingestion && data.ingestion.saved) || 0;
    var processed = (data.processing && data.processing.processed) || 0;
    toast('✓ Saved ' + saved + ' articles, processed ' + processed, 'ok');
    await loadSummary();
    await loadArticles();
    await loadTrending();
  } else {
    toast('Pipeline failed — check API connection', 'err');
  }
  btn.disabled = false; btn.textContent = '↻ Refresh';
  document.getElementById('statusTxt').textContent = 'Live';
}

// ── AUTH UI ───────────────────────────────────────────────────────────────────
function handleAuth() {
  if (S.token) {
    logout();
  } else {
    openAuth();
  }
}
function openAuth() {
  var m = document.getElementById('authModal');
  m.style.opacity = '1';
  m.style.pointerEvents = 'auto';
}
function closeAuth() {
  var m = document.getElementById('authModal');
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
}
function switchAuthMode() {
  S.authMode = S.authMode === 'login' ? 'register' : 'login';
  document.getElementById('authTitle').textContent = S.authMode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('authSwitch').textContent = S.authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login";
}
async function submitAuth() {
  var email = document.getElementById('authEmail').value;
  var pass = document.getElementById('authPass').value;
  if (!email || !pass) return toast('Please enter email and password', 'err');
  
  var path = S.authMode === 'login' ? '/auth/login' : '/auth/register';
  var data = await apiPost(path, { email: email, password: pass });
  
  if (data && data.access_token) {
    S.token = data.access_token;
    localStorage.setItem('ni_token', S.token);
    // Fetch profile to get role
    S.user = await apiFetch('/auth/me');
    closeAuth();
    updateAuthBtn();
    toast('Welcome back!', 'ok');
    setTimeout(function(){ window.location.reload(); }, 500);
  } else if (data && data.error === 'api_error') {
    var msg = data.detail;
    if (data.errors && data.errors.length) {
       msg = data.errors[0].message;
    } else if (Array.isArray(msg) && msg.length) {
       msg = msg[0].msg || JSON.stringify(msg[0]);
    }
    toast(msg, 'err');
  } else {
    toast('Invalid credentials or registration error', 'err');
  }
}
function logout() {
  S.token = null;
  localStorage.removeItem('ni_token');
  updateAuthBtn();
  toast('Logged out successfully', 'info');
  setTimeout(function(){ window.location.reload(); }, 500);
}
function updateAuthBtn() {
  var btn = document.getElementById('authBtn');
  var rBtn = document.getElementById('refreshBtn');
  var dBtn = document.getElementById('docsBtn');
  
  btn.textContent = S.token ? 'Logout' : 'Login';
  btn.classList.toggle('p', !!S.token);
  
  // Role based visibility
  var role = S.user ? S.user.role : null;
  rBtn.style.display = (role === 'admin') ? 'inline-flex' : 'none';
  
  // Fix Docs link
  dBtn.href = (window.API_BASE || '') + '/docs';
}

// ── LAYOUT ────────────────────────────────────────────────────────────────────
function updateLayout() {
  var m = window.innerWidth <= 768;
  document.getElementById('menuBtn').style.display = m ? 'inline-flex' : 'none';
  document.getElementById('docsBtn').style.display = window.innerWidth > 600 ? 'inline-flex' : 'none';
}
window.addEventListener('resize', updateLayout);

// ── INIT ──────────────────────────────────────────────────────────────────────
(async function init() {
  updateLayout();
  if (S.token && !S.user) {
    S.user = await apiFetch('/auth/me');
  }
  updateAuthBtn();
  // Load components in parallel so slow requests don't block others
  Promise.all([
    (async () => { await loadSummary(); })(),
    loadArticles(),
    loadTrending(),
  ]);
  initStocks();
})();