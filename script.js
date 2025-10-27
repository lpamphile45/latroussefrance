// --- Contrôle d'affichage (mode admin) ---
let serverAdmin = false;
let __lastRole = 'public';
let __syncTimer = null;
async function fetchAdminStatus() {
  try {
    const res = await fetch('/me.php?ts=' + Date.now(), { credentials: 'include', cache: 'no-store' });
    if (!res.ok) { serverAdmin = false; __lastRole = 'error:' + res.status; return; }
    const data = await res.json();
    __lastRole = (data && data.role) ? data.role : 'public';
    serverAdmin = (__lastRole === 'admin');
    window.__serverAdmin = serverAdmin; // debug helper
  } catch (e) {
    serverAdmin = false;
    __lastRole = 'error';
    window.__serverAdmin = serverAdmin;
  }
}
function isAdmin() { return serverAdmin; }

function createAdminToggle() {
    const existing = document.getElementById('admin-toggle');
    if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
    }
    const admin = isAdmin();

    const containerBtn = document.createElement('span');
    containerBtn.id = 'admin-toggle';
    containerBtn.style.marginLeft = '8px';

    const link = document.createElement('a');
    if (admin) {
        link.href = '/logout.php';
        link.textContent = 'Se déconnecter (admin)';
        link.title = 'Quitter la session admin (serveur)';
    } else {
        link.href = '/login.php';
        link.textContent = 'Se connecter';
        link.title = 'Ouvrir une session admin pour voir les éléments privés';
    }
    containerBtn.appendChild(link);

    const status = document.createElement('span');
    status.style.marginLeft = '8px';
    status.style.fontSize = '0.9em';
    //status.textContent = (admin ? '(statut: admin' : '(statut: public') + ' · me.php: ' + __lastRole + ')';
    containerBtn.appendChild(status);

    const searchBar = document.getElementById('search-bar');
    if (searchBar && searchBar.parentElement) {
        searchBar.parentElement.appendChild(containerBtn);
    } else {
        document.body.prepend(containerBtn);
    }
}

// Détermine si un document est restreint (supporte deux façons : doc.private === true OU tag #privé dans keywords)
function isRestrictedDoc(doc) {
    if (doc && doc.private === true) return true;
    const kw = (doc && typeof doc.keywords === "string") ? doc.keywords : "";
    // Détecte "privé", "prive", éventuellement précédé d'un #, en mot isolé
    return /(\s|^)#?priv[ée](\s|$)/i.test(kw);
}

// Charger les documents depuis data.js
function generateResults() {
    const container = document.querySelector(".result-container");
    if (!container) return;
    container.innerHTML = ""; // Nettoyer avant de remplir

    const admin = isAdmin();

    documents.forEach(doc => {
        // Filtrer les docs restreints si pas admin
        const restricted = isRestrictedDoc(doc);
        if (restricted && !admin) return;

        const div = document.createElement("div");
        div.classList.add("result");
        div.setAttribute("data-keywords", doc.keywords || "");

        // Vérifier si un lien existe
        let labelHTML = doc.link
            ? `<a href="${doc.link}" target="_blank" rel="noopener noreferrer">${doc.text}</a>`
            : `${doc.text}`;

        // Marquer visuellement les éléments privés pour l'admin
        const lock = restricted && admin ? " 🔒" : "";
        const icon = doc.icon ? `${doc.icon} ` : "";
        div.innerHTML = `${icon}<span class="highlight">${labelHTML}${lock}</span>`;

        container.appendChild(div);
    });

    setupSearch();
    const sb = document.getElementById('search-bar');
    if (sb) {
      const evt = new Event('input');
      sb.dispatchEvent(evt);
    }
}

// Fonction de recherche dynamique
function setupSearch() {
  const searchBar = document.getElementById("search-bar");
  if (!searchBar) return;

  // Empêcher doublons d'écouteurs
  if (searchBar.__onInput) {
    searchBar.removeEventListener("input", searchBar.__onInput);
  }
  if (searchBar.__onKeydown) {
    searchBar.removeEventListener("keydown", searchBar.__onKeydown);
  }

  let debounceTimer = null;

  const sendSearchEvent = (() => {
    let lastTerm = '';
    let lastSentAt = 0;
    return (term, trigger = 'debounce') => {
      if (typeof gtag !== 'function') return;
      const t = (term || '').trim().toLowerCase();
      // Ne jamais envoyer de recherche vide ou d'un seul caractère
      if (t.length < 2) return;
      // Évite les doublons rapprochés (même terme < 400 ms)
      const now = Date.now();
      if (t === lastTerm && (now - lastSentAt) < 400) return;

      // Compte les résultats actuellement visibles
      const list = Array.from(document.querySelectorAll('.result'));
      const visibleCount = list.filter(r => r.style.display !== 'none').length;

      gtag('event', 'search', {
        search_term: t,
        results_count: visibleCount,
        trigger
      });

      // (optionnel mais pratique pour les rapports standard GA4)
      gtag('event', 'view_search_results', {
        search_term: t,
        results_count: visibleCount,
        trigger
      });

      lastTerm = t;
      lastSentAt = now;
    };
  })();

  const applyFilter = (term) => {
    const results = document.querySelectorAll('.result');
    const t = (term || '').trim().toLowerCase();
    if (t === '') {
      results.forEach(r => r.style.display = 'none');
      return;
    }
    const searchWords = t.split(/\s+/);
    results.forEach(result => {
      const keywords = (result.getAttribute('data-keywords') || '').toLowerCase();
      const match = searchWords.every(word => keywords.includes(word));
      result.style.display = match ? 'block' : 'none';
    });
  };

  const onInput = function () {
    const term = (this.value || '').trim().toLowerCase();
    applyFilter(term);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => sendSearchEvent(term, 'debounce'), 500);
  };

  const onKeydown = function (e) {
    if (e.key === 'Enter') {
      const term = (this.value || '').trim().toLowerCase();
      sendSearchEvent(term, 'enter');
    }
  };

  searchBar.addEventListener("input", onInput);
  searchBar.addEventListener("keydown", onKeydown);
  searchBar.__onInput = onInput;
  searchBar.__onKeydown = onKeydown;

  // Appliquer l'état initial en fonction du champ de recherche
  applyFilter(searchBar.value);
}

// (Optionnel) tracer les clics sur les résultats
document.addEventListener('click', (e) => {
  const a = e.target.closest('.result a');
  if (!a) return;
  if (typeof gtag === 'function') {
    const searchTerm = (document.getElementById('search-bar')?.value || '').trim();
    const results = Array.from(document.querySelectorAll('.result')).filter(r => r.style.display !== 'none');
    const index = results.findIndex(r => r.contains(a)) + 1;
    gtag('event', 'select_item', {
      search_term: searchTerm,
      item_list_name: 'search_results',
      items: [{
        item_id: a.getAttribute('href'),
        item_name: (a.textContent || '').trim(),
        index: index
      }]
    });
  }
});

function init() {
    fetchAdminStatus().then(() => {
        createAdminToggle();
        generateResults();
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchAdminStatus().then(() => {
      const btn = document.getElementById('admin-toggle');
      if (btn && btn.parentElement) btn.parentElement.removeChild(btn);
      createAdminToggle();
      generateResults();
    });
  }
});

// Fallback: petit polling 5x toutes les 2s pour capter un login sans changement de visibilité
(function(){
  let tries = 5;
  const t = setInterval(() => {
    tries--;
    fetchAdminStatus().then(() => {
      const btn = document.getElementById('admin-toggle');
      if (btn && btn.parentElement) btn.parentElement.removeChild(btn);
      createAdminToggle();
      generateResults();
      if (serverAdmin || tries <= 0) clearInterval(t);
    });
  }, 2000);
})();
