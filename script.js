// ─── STATE ───
let accounts = [];
let developerAccounts = [];
let allGames = [];
let currentAccountIndex = 'all';
let loggedInDeveloper = null;
let filterPublished = false;
let sortField = 'downloads';
let sortDir = 'desc';

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
  // Enter key triggers login from either input
  ['loginUsername', 'loginPassword'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  });

  filterPublished = localStorage.getItem('itchstats_filter_published') === 'true';
  sortField = localStorage.getItem('itchstats_sort_field') || 'downloads';
  sortDir = localStorage.getItem('itchstats_sort_dir') || 'desc';

  const savedDeveloperAccounts = localStorage.getItem('itchstats_dev_accounts');
  const savedProxy = localStorage.getItem('itchstats_proxy');
  
  if (savedDeveloperAccounts) {
    developerAccounts = JSON.parse(savedDeveloperAccounts);
  }

  // Check if user was previously logged in
  const savedSession = localStorage.getItem('itchstats_session');
  if (savedSession) {
    const session = JSON.parse(savedSession);
    loggedInDeveloper = session.username;
    loadAuthenticatedDashboard(session);
    return;
  }

  // Show login if accounts exist, otherwise show admin setup
  if (developerAccounts.length > 0) {
    showLoginScreen();
  } else {
    showAdminSetup();
  }
});

// ─── AUTHENTICATION ───
function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.add('visible');
}

function clearLoginError() {
  const el = document.getElementById('loginError');
  el.textContent = '';
  el.classList.remove('visible');
}

function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  clearLoginError();

  if (!username || !password) {
    showLoginError('Please enter your username and password.');
    return;
  }

  const dev = developerAccounts.find(a => a.username === username);
  if (!dev || dev.password !== password) {
    showLoginError('Invalid username or password.');
    return;
  }

  // Store session with all API keys
  const session = {
    username: dev.username,
    apiKeys: dev.apiKeys || []
  };
  localStorage.setItem('itchstats_session', JSON.stringify(session));
  loggedInDeveloper = username;

  loadAuthenticatedDashboard(session);
  showToast(`Welcome, ${username}!`);
}

function loadAuthenticatedDashboard(session) {
  // Load with all assigned API keys
  accounts = (session.apiKeys || []).map(k => ({ name: k.name, key: k.key }));
  currentAccountIndex = accounts.length > 1 ? 'all' : 0;
  
  // Show hamburger and logged in user
  document.getElementById('hamburgerBtn').style.display = ''; // remove inline override; CSS + media query take it from here
  document.getElementById('loggedInUser').textContent = `Logged in as: ${session.username}`;
  
  renderAccountTabs();
  loadDashboard();
}

function handleLogout() {
  if (confirm('Log out?')) {
    localStorage.removeItem('itchstats_session');
    loggedInDeveloper = null;
    accounts = [];
    allGames = [];
    currentAccountIndex = 'all';
    document.getElementById('accountTabs').innerHTML = '';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('hamburgerBtn').style.display = 'none';
    clearLoginError();
    closeSidebar();
    showLoginScreen();
    showToast('Logged out');
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('loggedInUser').textContent = '';
}

function showAdminSetup() {
  const savedProxy = localStorage.getItem('itchstats_proxy');
  if (savedProxy) document.getElementById('adminProxyUrl').value = savedProxy;

  const backBtn = document.getElementById('adminBackBtn');
  const closeBtn = document.getElementById('adminCloseBtn');
  if (loggedInDeveloper) {
    backBtn.textContent = '← Back to Dashboard';
    backBtn.onclick = loadDashboard;
    closeBtn.style.display = 'flex';
  } else {
    backBtn.textContent = '← Back to Login';
    backBtn.onclick = showLoginScreen;
    closeBtn.style.display = 'none';
  }

  renderAdminAccountFields();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminScreen').style.display = 'flex';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'none';
}

function renderAdminAccountFields() {
  const list = document.getElementById('adminAccountsList');
  const items = developerAccounts.length > 0 ? developerAccounts : [];
  
  if (items.length === 0) {
    list.innerHTML = '<div style="color: var(--text-muted); font-family: var(--mono); font-size: 0.72rem; padding: 1rem 0;">No accounts created yet.</div>';
    return;
  }

  list.innerHTML = items.map((a, i) => {
    const keysHtml = (a.apiKeys || []).map((k, ki) => `
      <div>
        <div style="display: grid; grid-template-columns: auto 1fr 1fr; gap: 0.5rem; margin-bottom: 0.2rem;">
          <div style="width: 24px;"></div>
          <div class="field-label">Account Name</div>
          <div class="field-label">API Key</div>
        </div>
        <div style="display: grid; grid-template-columns: auto 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem; align-items: center;">
          <button class="remove-btn" onclick="removeAdminApiKey(${i}, ${ki})" style="margin: 0; width: 24px; height: 24px; padding: 0; flex-shrink: 0;" title="Remove API Key">✕</button>
          <input type="text" value="${k.name}" id="admin-name-${i}-${ki}" style="width: 100%;" />
          <div style="position: relative; display: flex; align-items: center;">
            <input type="password" value="${k.key}" id="admin-key-${i}-${ki}" style="width: 100%; font-size: 0.65rem; padding-right: 2rem;" />
            <button class="copy-btn" onclick="toggleKeyVisibility(${i}, ${ki})" style="position: absolute; right: 0.5rem; margin: 0; padding: 0; background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-dim);">👁</button>
          </div>
        </div>
      </div>
    `).join('');
    
    return `
      <div style="background: var(--bg3); padding: 1.2rem; border: 1px solid var(--border); margin-bottom: 1.5rem;">
        <div class="account-entry-admin" id="admin-entry-${i}">
          <div>
            <div class="field-label" style="margin-bottom: 0.2rem;">Username</div>
            <input type="text" value="${a.username}" id="admin-user-${i}" style="width: 100%;" />
          </div>
          <div>
            <div class="field-label" style="margin-bottom: 0.2rem;">Password</div>
            <input type="password" value="${a.password}" id="admin-pass-${i}" style="width: 100%;" />
          </div>
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
          <div style="font-family: var(--mono); font-size: 0.68rem; color: var(--text-dim); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">API Keys:</div>
          ${keysHtml}
          <button class="add-account-btn" onclick="addAdminApiKey(${i})" style="margin: 0; margin-bottom: 0.8rem;">+ Add Another API Key</button>
          <button class="remove-btn" onclick="confirmDeleteAccount(${i})" style="width: 100%; margin: 0;" title="Delete this account">Delete Account</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleKeyVisibility(i, ki) {
  const input = document.getElementById(`admin-key-${i}-${ki}`);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function addAdminApiKey(i) {
  // Sync form data to developerAccounts first (prevents data loss on re-render)
  if (!developerAccounts[i]) {
    developerAccounts[i] = { username: '', password: '', apiKeys: [] };
  }
  
  // Read current form values for this account
  const userEl = document.getElementById(`admin-user-${i}`);
  const passEl = document.getElementById(`admin-pass-${i}`);
  if (userEl) developerAccounts[i].username = userEl.value.trim();
  if (passEl) developerAccounts[i].password = passEl.value.trim();
  
  // Read existing API keys from form
  if (!developerAccounts[i].apiKeys) developerAccounts[i].apiKeys = [];
  developerAccounts[i].apiKeys = [];
  let ki = 0;
  while (true) {
    const nameEl = document.getElementById(`admin-name-${i}-${ki}`);
    const keyEl = document.getElementById(`admin-key-${i}-${ki}`);
    if (!nameEl) break;
    
    const name = nameEl.value.trim();
    const key = keyEl.value.trim();
    if (name || key) {
      developerAccounts[i].apiKeys.push({ name, key });
    }
    ki++;
  }
  
  // Now add the new empty API key
  developerAccounts[i].apiKeys.push({ name: '', key: '' });
  renderAdminAccountFields();
}

function removeAdminApiKey(i, ki) {
  if (developerAccounts[i].apiKeys) {
    developerAccounts[i].apiKeys.splice(ki, 1);
    renderAdminAccountFields();
  }
}

function addAdminAccountField() {
  const i = developerAccounts.length;
  // Add placeholder account to the array so it's tracked
  developerAccounts.push({ username: '', password: '', apiKeys: [{ name: '', key: '' }] });
  renderAdminAccountFields();
}

function removeAdminAccount(i) {
  developerAccounts.splice(i, 1);
  renderAdminAccountFields();
}

function saveAdminAccounts() {
  const adminPass = document.getElementById('adminPassword').value.trim();
  const proxyUrl = document.getElementById('adminProxyUrl').value.trim();

  if (!adminPass) {
    showToast('Please set a master password', true);
    return;
  }
  if (!proxyUrl) {
    showToast('Please enter your Cloudflare Worker proxy URL', true);
    return;
  }

  const newAccounts = [];
  let i = 0;
  while (true) {
    const user = document.getElementById(`admin-user-${i}`);
    if (!user) break;

    const pass = document.getElementById(`admin-pass-${i}`);
    const username = user.value.trim();
    const password = pass.value.trim();

    if (username && password) {
      // Collect all API keys for this account
      const apiKeys = [];
      let ki = 0;
      while (true) {
        const nameEl = document.getElementById(`admin-name-${i}-${ki}`);
        const keyEl = document.getElementById(`admin-key-${i}-${ki}`);
        if (!nameEl) break;
        
        const name = nameEl.value.trim();
        const key = keyEl.value.trim();
        if (name && key) {
          apiKeys.push({ name, key });
        }
        ki++;
      }

      if (apiKeys.length > 0) {
        newAccounts.push({ username, password, apiKeys });
      }
    }
    i++;
  }

  if (newAccounts.length === 0) {
    showToast('Please add at least one developer account with API keys', true);
    return;
  }

  developerAccounts = newAccounts;
  localStorage.setItem('itchstats_dev_accounts', JSON.stringify(developerAccounts));
  localStorage.setItem('itchstats_proxy', proxyUrl);
  localStorage.setItem('itchstats_admin_pass', adminPass);

  showToast('Accounts saved! Developers can now login.');
  setTimeout(() => showLoginScreen(), 1000);
}

// ─── EXPORT / IMPORT ───
function exportAccounts() {
  const adminPass = document.getElementById('adminPassword').value.trim();
  const proxyUrl = document.getElementById('adminProxyUrl').value.trim();

  if (!adminPass) {
    showToast('Please set a master password first', true);
    return;
  }
  if (!proxyUrl) {
    showToast('Please enter your proxy URL first', true);
    return;
  }

  // Collect current form state (unsaved accounts)
  const currentAccounts = [];
  let i = 0;
  while (true) {
    const user = document.getElementById(`admin-user-${i}`);
    if (!user) break;

    const pass = document.getElementById(`admin-pass-${i}`);
    const username = user.value.trim();
    const password = pass.value.trim();

    if (username && password) {
      const apiKeys = [];
      let ki = 0;
      while (true) {
        const nameEl = document.getElementById(`admin-name-${i}-${ki}`);
        const keyEl = document.getElementById(`admin-key-${i}-${ki}`);
        if (!nameEl) break;
        
        const name = nameEl.value.trim();
        const key = keyEl.value.trim();
        if (name && key) {
          apiKeys.push({ name, key });
        }
        ki++;
      }

      if (apiKeys.length > 0) {
        currentAccounts.push({ username, password, apiKeys });
      }
    }
    i++;
  }

  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    adminPassword: adminPass,
    proxyUrl: proxyUrl,
    developerAccounts: currentAccounts.length > 0 ? currentAccounts : developerAccounts
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `itchstats-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Backup exported! Share this file securely.');
}

function importAccounts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);

        if (!backup.adminPassword || !backup.proxyUrl || !backup.developerAccounts) {
          showToast('Invalid backup file format', true);
          return;
        }

        // Load the backup into forms
        document.getElementById('adminPassword').value = backup.adminPassword;
        document.getElementById('adminProxyUrl').value = backup.proxyUrl;
        developerAccounts = backup.developerAccounts;
        
        renderAdminAccountFields();
        showToast(`Imported ${backup.developerAccounts.length} accounts! Review before saving.`);
      } catch (err) {
        showToast('Failed to parse backup file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ─── SETUP ───
function showSetup() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'none';
  renderAccountFields();
  const savedProxy = localStorage.getItem('itchstats_proxy');
  if (savedProxy) document.getElementById('proxyUrl').value = savedProxy;
}

function renderAccountFields() {
  const list = document.getElementById('accountsList');
  const savedAccounts = accounts.length > 0 ? accounts : [{ name: '', key: '' }];
  list.innerHTML = savedAccounts.map((a, i) => `
    <div class="account-entry" id="entry-${i}">
      <input type="text" placeholder="Account name" value="${a.name}" id="name-${i}" />
      <input type="password" placeholder="API Key" value="${a.key}" id="key-${i}" />
      <button class="remove-btn" onclick="removeAccountField(${i})">✕</button>
    </div>
  `).join('');
  if (accounts.length === 0) addAccountField();
}

function addAccountField() {
  const list = document.getElementById('accountsList');
  const i = list.children.length;
  const div = document.createElement('div');
  div.className = 'account-entry';
  div.id = `entry-${i}`;
  div.innerHTML = `
    <input type="text" placeholder="Account name" id="name-${i}" />
    <input type="password" placeholder="API Key" id="key-${i}" />
    <button class="remove-btn" onclick="removeAccountField(${i})">✕</button>
  `;
  list.appendChild(div);
}

function removeAccountField(i) {
  const el = document.getElementById(`entry-${i}`);
  if (el) el.remove();
}

function saveAndLoad() {
  const entries = document.querySelectorAll('.account-entry');
  const newAccounts = [];
  entries.forEach((_, i) => {
    const name = document.getElementById(`name-${i}`)?.value.trim();
    const key = document.getElementById(`key-${i}`)?.value.trim();
    if (name && key) newAccounts.push({ name, key });
  });

  const proxyUrl = document.getElementById('proxyUrl')?.value.trim();
  if (!proxyUrl) {
    showToast('Please enter your Cloudflare Worker proxy URL.', true);
    return;
  }
  if (newAccounts.length === 0) {
    showToast('Please add at least one account with a name and API key.', true);
    return;
  }

  accounts = newAccounts;
  localStorage.setItem('itchstats_accounts', JSON.stringify(accounts));
  localStorage.setItem('itchstats_proxy', proxyUrl);
  renderAccountTabs();
  loadDashboard();
}

// ─── ACCOUNT TABS ───
function renderAccountTabs() {
  const container = document.getElementById('accountTabs');
  let tabs = '';
  if (accounts.length > 1) {
    tabs += `<button class="account-tab ${currentAccountIndex === 'all' ? 'active' : ''}" onclick="switchAccount('all')">ALL</button>`;
  }
  accounts.forEach((a, i) => {
    tabs += `<button class="account-tab ${currentAccountIndex === i ? 'active' : ''}" onclick="switchAccount(${i})">${a.name.toUpperCase()}</button>`;
  });
  container.innerHTML = tabs;
}

function switchAccount(idx) {
  currentAccountIndex = idx;
  renderAccountTabs();
  renderDashboard();
}

// ─── LOAD DASHBOARD ───
async function loadDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'flex';

  allGames = [];
  for (const account of accounts) {
    try {
      const games = await fetchGames(account.key, account.name);
      allGames = allGames.concat(games);
    } catch (e) {
      showToast(`Failed to load "${account.name}": ${e.message}`, true);
    }
  }

  localStorage.setItem('itchstats_games', JSON.stringify(allGames));
  localStorage.setItem('itchstats_lastsync', new Date().toISOString());

  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  renderDashboard();
}

async function syncData() {
  const saved = localStorage.getItem('itchstats_accounts');
  const proxy = localStorage.getItem('itchstats_proxy');
  if (!saved || !proxy) { showSetup(); return; }
  accounts = JSON.parse(saved);
  await loadDashboard();
  showToast('Synced successfully!');
}

async function fetchGames(apiKey, accountName) {
  const proxy = localStorage.getItem('itchstats_proxy');
  if (!proxy) throw new Error('No proxy URL configured.');
  const url = `${proxy}?key=${encodeURIComponent(apiKey)}&path=my-games`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]);
  if (data.error) throw new Error(data.error);
  return (data.games || []).map(g => ({ ...g, _account: accountName }));
}

// ─── SECRET ADMIN ACCESS ───
let _logoTaps = 0, _logoTimer = null;
function handleLogoTap() {
  _logoTaps++;
  clearTimeout(_logoTimer);
  if (_logoTaps >= 7) {
    _logoTaps = 0;
    showAdminSetup();
  } else {
    _logoTimer = setTimeout(() => { _logoTaps = 0; }, 1800);
  }
}

// ─── SIDEBAR ───
function openSidebar() {
  renderSidebarAccounts();
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderSidebarAccounts() {
  const container = document.getElementById('sidebarAccounts');
  if (!container) return;
  let html = '';
  if (accounts.length > 1) {
    html += `<button class="sidebar-account-btn ${currentAccountIndex === 'all' ? 'active' : ''}"
      onclick="switchAccount('all'); closeSidebar()">
      <span>All Accounts</span>
      <span class="sidebar-account-count">${allGames.length} games</span>
    </button>`;
  }
  accounts.forEach((a, i) => {
    const count = allGames.filter(g => g._account === a.name).length;
    html += `<button class="sidebar-account-btn ${currentAccountIndex === i ? 'active' : ''}"
      onclick="switchAccount(${i}); closeSidebar()">
      <span>${a.name}</span>
      <span class="sidebar-account-count">${count} games</span>
    </button>`;
  });
  container.innerHTML = html || '<div style="font-family:var(--mono);font-size:0.7rem;color:var(--text-muted);">No accounts loaded.</div>';

  // Footer: logged-in user + last sync
  const ls = localStorage.getItem('itchstats_lastsync');
  const syncText = ls ? new Date(ls).toLocaleString() : '—';
  const footer = document.getElementById('sidebarFooter');
  if (footer) footer.innerHTML =
    (loggedInDeveloper ? `<div>${loggedInDeveloper}</div>` : '') +
    `<div style="color:var(--text-muted)">Last synced: ${syncText}</div>`;
}

// ─── FILTER / SORT ───
function toggleFilterPublished() {
  filterPublished = !filterPublished;
  localStorage.setItem('itchstats_filter_published', filterPublished);
  renderDashboard();
}

function setSortField(field) {
  sortField = field;
  localStorage.setItem('itchstats_sort_field', field);
  renderDashboard();
}

function toggleSortDir() {
  sortDir = sortDir === 'desc' ? 'asc' : 'desc';
  localStorage.setItem('itchstats_sort_dir', sortDir);
  renderDashboard();
}

// ─── RENDER DASHBOARD ───
function renderDashboard() {
  const games = currentAccountIndex === 'all'
    ? allGames
    : allGames.filter(g => g._account === accounts[currentAccountIndex]?.name);

  // Build display list: filter then sort
  let displayGames = filterPublished ? games.filter(g => g.published_at) : [...games];
  displayGames.sort((a, b) => {
    if (sortField === 'title') {
      return sortDir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    }
    let va = 0, vb = 0;
    if (sortField === 'views')     { va = a.views_count||0;      vb = b.views_count||0; }
    else if (sortField === 'revenue')  { va = earningsAmt(a.earnings); vb = earningsAmt(b.earnings); }
    else if (sortField === 'purchases'){ va = a.purchases_count||0;  vb = b.purchases_count||0; }
    else if (sortField === 'published'){ va = a.published_at ? new Date(a.published_at).getTime() : 0;
                                         vb = b.published_at ? new Date(b.published_at).getTime() : 0; }
    else                               { va = a.downloads_count||0;  vb = b.downloads_count||0; }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Sync controls UI to current state
  const filterBtn = document.getElementById('filterPublishedBtn');
  if (filterBtn) filterBtn.classList.toggle('active', filterPublished);
  const sortSelect = document.getElementById('sortFieldSelect');
  if (sortSelect) sortSelect.value = sortField;
  const dirBtn = document.getElementById('sortDirBtn');
  if (dirBtn) dirBtn.textContent = sortDir === 'desc' ? '↓' : '↑';

  // Last sync
  const ls = localStorage.getItem('itchstats_lastsync');
  if (ls) {
    const d = new Date(ls);
    document.getElementById('lastSyncTime').textContent = d.toLocaleString();
  }

  const acctLabel = currentAccountIndex === 'all'
    ? `Showing all ${accounts.length} accounts`
    : `Account: ${accounts[currentAccountIndex]?.name}`;
  document.getElementById('activeAccountLabel').textContent =
    loggedInDeveloper ? `${acctLabel} · ${loggedInDeveloper}` : acctLabel;

  // Totals
  const totalDl = games.reduce((s, g) => s + (g.downloads_count || 0), 0);
  const totalVw = games.reduce((s, g) => s + (g.views_count || 0), 0);
  // Aggregate earnings per currency for accurate total display
  const byCurrency = {};
  games.forEach(g => {
    if (Array.isArray(g.earnings)) {
      g.earnings.forEach(e => { byCurrency[e.currency] = (byCurrency[e.currency] || 0) + (e.amount || 0); });
    } else {
      const n = parseFloat(g.earnings);
      if (isFinite(n) && n > 0) byCurrency['USD'] = (byCurrency['USD'] || 0) + n;
    }
  });
  const totalRvDisplay = Object.keys(byCurrency).length
    ? Object.entries(byCurrency).map(([cur, amt]) => {
        const sym = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥' }[cur] || cur + ' ';
        return sym + (amt / 100).toFixed(2);
      }).join(' + ')
    : '$0.00';

  document.getElementById('totalDownloads').textContent = fmt(totalDl);
  document.getElementById('totalViews').textContent = fmt(totalVw);
  document.getElementById('totalRevenue').textContent = totalRvDisplay;
  document.getElementById('totalGames').textContent = games.length;

  // Section title with game count (show filtered/total when filter is active)
  const countLabel = filterPublished && displayGames.length !== games.length
    ? `${displayGames.length}/${games.length}`
    : `${displayGames.length}`;
  document.getElementById('gamesSectionTitle').innerHTML =
    `Your Games <span class="games-count">${countLabel}</span>`;

  // Top games panels
  if (games.length > 0) {
    document.getElementById('topGamesHeader').style.display = 'flex';
    document.getElementById('topGamesRow').style.display = 'grid';

    function fillPanel(nameId, valId, sortFn, displayFn) {
      const top = [...games].sort(sortFn)[0];
      document.getElementById(nameId).textContent = top.title;
      document.getElementById(valId).textContent = displayFn(top);
    }

    fillPanel('tgNameViews', 'tgValViews',
      (a, b) => (b.views_count || 0) - (a.views_count || 0),
      g => fmt(g.views_count || 0));

    fillPanel('tgNameDownloads', 'tgValDownloads',
      (a, b) => (b.downloads_count || 0) - (a.downloads_count || 0),
      g => fmt(g.downloads_count || 0));

    fillPanel('tgNamePurchases', 'tgValPurchases',
      (a, b) => (b.purchases_count || 0) - (a.purchases_count || 0),
      g => fmt(g.purchases_count || 0));

    fillPanel('tgNameRevenue', 'tgValRevenue',
      (a, b) => cents(b.earnings) - cents(a.earnings),
      g => formatRevenue(g.earnings));
  }

  // Games grid
  const grid = document.getElementById('gamesGrid');
  if (displayGames.length === 0) {
    grid.innerHTML = `<div style="padding:2rem;font-family:var(--mono);font-size:0.75rem;color:var(--text-muted);letter-spacing:0.08em;">${games.length === 0 ? 'No games found for this account.' : 'No published games match the current filter.'}</div>`;
    return;
  }

  grid.innerHTML = displayGames.map((g, i) => `
    <div class="game-card" onclick="openModal(${g.id})" style="animation-delay:${i * 0.04}s">
      ${g.cover_url
        ? `<img class="game-cover" src="${g.cover_url}" alt="${g.title}" onerror="this.outerHTML='<div class=\\'game-cover-placeholder\\'>🎮</div>'" />`
        : `<div class="game-cover-placeholder">🎮</div>`
      }
      <div class="game-cover-overlay"><span class="view-detail-hint">View Details →</span></div>
      <div class="game-info">
        <div class="game-title">${g.title}</div>
        <div class="game-stats-row">
          <div class="mini-stat">
            <div class="mini-stat-val">${fmt(g.downloads_count || 0)}</div>
            <div class="mini-stat-label">Downloads</div>
          </div>
          <div class="mini-stat">
            <div class="mini-stat-val">${fmt(g.views_count || 0)}</div>
            <div class="mini-stat-label">Views</div>
          </div>
          <div class="mini-stat">
            <div class="mini-stat-val${earningsAmt(g.earnings) > 0 ? ' money' : ''}">${formatRevenue(g.earnings)}</div>
            <div class="mini-stat-label">Revenue</div>
          </div>
        </div>
        <div class="game-platform-tags">
          ${g.p_windows ? '<span class="platform-tag">WIN</span>' : ''}
          ${g.p_osx ? '<span class="platform-tag">MAC</span>' : ''}
          ${g.p_linux ? '<span class="platform-tag">LNX</span>' : ''}
          ${g.p_android ? '<span class="platform-tag">AND</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ─── MODAL ───
function openModal(gameId) {
  const g = allGames.find(g => g.id === gameId);
  if (!g) return;

  document.getElementById('modalTitle').textContent = g.title;
  const urlEl = document.getElementById('modalUrl');
  urlEl.href = g.url || '#';
  document.getElementById('modalDownloads').textContent = fmt(g.downloads_count || 0);
  document.getElementById('modalViews').textContent = fmt(g.views_count || 0);
  const revEl = document.getElementById('modalRevenue');
  revEl.textContent = formatRevenue(g.earnings);
  revEl.classList.toggle('money', earningsAmt(g.earnings) > 0);
  document.getElementById('modalPurchases').textContent = fmt(g.purchases_count || 0);
  document.getElementById('modalDesc').textContent = g.short_text || '';

  // Published date
  const metaPublished = document.getElementById('modalMetaPublished');
  if (g.published_at) {
    const d = new Date(g.published_at);
    document.getElementById('modalPublishedVal').textContent =
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    metaPublished.style.display = '';
  } else {
    metaPublished.style.display = 'none';
  }

  // Price
  const metaPrice = document.getElementById('modalMetaPrice');
  if (g.min_price != null) {
    document.getElementById('modalPriceVal').textContent =
      g.min_price === 0 ? 'Free' : '$' + (g.min_price / 100).toFixed(2) + '+';
    metaPrice.style.display = '';
  } else {
    metaPrice.style.display = 'none';
  }

  // Platforms
  const platforms = [
    g.p_windows && 'WIN', g.p_osx && 'MAC', g.p_linux && 'LNX',
    g.p_android && 'AND', g.p_html5 && 'WEB',
  ].filter(Boolean);
  const metaPlatforms = document.getElementById('modalMetaPlatforms');
  if (platforms.length > 0) {
    document.getElementById('modalPlatformsVal').innerHTML =
      platforms.map(p => `<span class="modal-meta-tag">${p}</span>`).join('');
    metaPlatforms.style.display = '';
  } else {
    metaPlatforms.style.display = 'none';
  }

  const coverEl = document.getElementById('modalCover');
  if (g.cover_url) {
    coverEl.innerHTML = `<img class="modal-cover" src="${g.cover_url}" alt="${g.title}" onerror="this.outerHTML='<div class=\\'modal-cover-placeholder\\'>🎮</div>'" />`;
  } else {
    coverEl.innerHTML = `<div class="modal-cover-placeholder">🎮</div>`;
  }

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModalDirect();
}

function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── TOAST ───
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ─── UTILS ───
function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// Returns earnings as a raw number (cents) for sorting/summing.
// earnings can be a plain number (cents) or an array of {amount, currency, amount_formatted}.
function earningsAmt(earnings) {
  if (Array.isArray(earnings)) return earnings.reduce((s, e) => s + (e.amount || 0), 0);
  const n = parseFloat(earnings);
  return isFinite(n) ? n : 0;
}

// Returns a display string using amount_formatted when available, otherwise formats manually.
function formatRevenue(earnings) {
  if (Array.isArray(earnings)) {
    if (earnings.length === 0) return '$0.00';
    return earnings.map(e => {
      if (e.amount_formatted) return e.amount_formatted;
      const sym = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥' }[e.currency] || (e.currency + ' ');
      return sym + (e.amount / 100).toFixed(2);
    }).join(' + ');
  }
  const n = parseFloat(earnings);
  return '$' + (isFinite(n) ? n / 100 : 0).toFixed(2);
}

// Keep cents() as an alias for backwards compat
function cents(val) { return earningsAmt(val); }

// ─── SETTINGS SHORTCUT (long press logo) ───
let logoTimer;
const logoEl = document.querySelector('.logo');
if (logoEl) {
  logoEl.addEventListener('mousedown', () => {
    logoTimer = setTimeout(() => {
      const adminPass = localStorage.getItem('itchstats_admin_pass');
      const pass = prompt('Enter master password to access admin panel:');
      if (pass && pass === adminPass) {
        showAdminSetup();
      } else if (pass !== null) {
        showToast('Invalid password', true);
      }
    }, 1200);
  });
  logoEl.addEventListener('mouseup', () => clearTimeout(logoTimer));
}