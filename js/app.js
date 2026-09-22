const csrf = document.querySelector('meta[name="csrf-token"]')?.content || 'demo-token';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function toast(text) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

const clock = document.getElementById('clock');
if (clock) {
  const updateClock = () => {
    const time = new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    clock.textContent = time;
  };
  updateClock();
  setInterval(updateClock, 10000);
}

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const title = document.querySelector('.view-title');

function showView(target) {
  navItems.forEach(link => {
    const isActive = link.dataset.target === target;
    link.classList.toggle('active', isActive);
  });

  views.forEach(view => {
    const isVisible = view.dataset.view === target;
    view.classList.toggle('active', isVisible);
  });

  const viewNames = {
    dashboard: 'Dashboard',
    diagnose: 'Diagnose',
    repair: 'Reparatur',
    updates: 'Updates',
    audit: 'Verlauf / Audit-Log',
    settings: 'Einstellungen'
  };

  if (title) {
    title.textContent = viewNames[target] || 'Dashboard';
  }

  toast('Navigationsseite: ' + (viewNames[target] || 'Dashboard'));
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    showView(item.dataset.target);
  });
});

const actionCards = document.querySelectorAll('.action-card');
actionCards.forEach(card => {
  card.addEventListener('click', event => {
    event.preventDefault();
    const label = card.querySelector('strong')?.textContent || 'Aktion';
    toast(label + ' ausgelöst');
  });
});

const linkButtons = document.querySelectorAll('.link-btn');
linkButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    toast('Audit-Log geöffnet');
  });
});

const powerButton = document.querySelector('.icon-btn');
if (powerButton) {
  powerButton.addEventListener('click', () => toast('System wird beendet'));
}

async function demoSequence() {
  await wait(1200);
  const badge = document.querySelector('.status-badge');
  if (badge) {
    badge.classList.add('spin');
  }
  toast('Diagnose wird ausgeführt');
  await wait(2000);
  if (badge) {
    badge.classList.remove('spin');
  }
  const statusCard = document.querySelector('.status-card');
  if (statusCard) {
    statusCard.classList.remove('ok');
    statusCard.classList.add('warn');
    statusCard.querySelector('h2').textContent = 'Hinweise gefunden';
    statusCard.querySelector('p').innerHTML = 'Treiber-Update verfügbar.<br />Reparatur kann gestartet werden.';
  }
  const pills = document.querySelectorAll('.pill');
  pills.forEach((pill, index) => {
    if (index === 1) {
      pill.className = 'pill warn';
      pill.textContent = 'warn';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', demoSequence);
} else {
  demoSequence();
}
