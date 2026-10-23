const SUPABASE_URL = "https://zapcodeubntucstwlyjg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphcGNvZGV1Ym50dWNzdHdseWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3ODcyMjEsImV4cCI6MjEwODM2MzIyMX0.AM1jXR3VthIqKJzdPwwDUvUK2A5hmAKu-wgQObHFUnM";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");
const toast = document.getElementById("toast");
const resultsTab = document.getElementById("tab-results");

let currentPage = "home";
let currentUser = null;
let profile = null;
let settings = { id: 1, results_enabled: false };
let adminLoginOpen = false;
let toastTimer = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function showToast(message, type = "") {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 3600);
}

function errorMessage(error) {
  if (!error) return "Ocurrió un error inesperado.";
  if (error.code === "23505") return "Ya registraste ese voto o ese disfraz. Revisa la lista.";
  if (error.code === "42501") return "La base de datos bloqueó esta acción por permisos.";
  return error.message || "Ocurrió un error inesperado.";
}

async function loadProfile() {
  const { data, error } = await db.from("participants")
    .select("id, display_name, is_admin")
    .eq("id", currentUser.id).single();
  if (error) throw error;
  profile = data;
}

async function loadSettings() {
  const { data, error } = await db.from("event_settings")
    .select("id, results_enabled").eq("id", 1).single();
  if (error) throw error;
  settings = data;
  resultsTab.style.display = settings.results_enabled ? "inline-flex" : "none";
}

async function loadCostumes() {
  const { data, error } = await db.from("costume_directory")
    .select("id, owner_id, costume_name, description, created_at, display_name")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadMyVotes() {
  const { data, error } = await db.from("votes")
    .select("costume_id").eq("voter_id", currentUser.id);
  if (error) throw error;
  return new Set((data || []).map(vote => vote.costume_id));
}

function pageHead(eyebrow, title, description) {
  return `<div class="page-head"><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="muted">${description}</p></div>`;
}

function renderHome() {
  const name = profile?.display_name?.trim();
  const adminArea = profile?.is_admin
    ? `<div class="admin-box"><h3>🗝️ Panel de anfitrión</h3><p>Controla cuándo aparece la pestaña de resultados. Los votos y sus cantidades solo se consultan desde tu perfil de administrador.</p><div class="admin-actions"><button class="primary" id="toggle-results">${settings.results_enabled ? "Ocultar resultados" : "🎃 Activar resultados"}</button><button class="secondary" id="go-results" ${settings.results_enabled ? "" : "disabled"}>Ver resultados privados</button></div></div>`
    : `<div class="admin-box"><h3>¿Eres quien organiza la fiesta?</h3><p>Accede con la cuenta administradora que configuraste en Supabase.</p><button class="secondary" id="show-admin-login">Acceso de administrador</button>${adminLoginOpen ? `<form id="admin-login-form" class="admin-login-form" style="margin-top:16px"><div class="field"><label for="admin-email">Correo de administrador</label><input id="admin-email" type="email" autocomplete="username" required></div><div class="field"><label for="admin-password">Contraseña</label><input id="admin-password" type="password" autocomplete="current-password" required></div><button class="primary" type="submit">Entrar al panel</button></form>` : ""}</div>`;

  return `<section class="hero"><p class="eyebrow">🕸️ ${name ? `BIENVENIDO, ${escapeHtml(name)}` : "EL CONCURSO COMIENZA AQUÍ"}</p><h1>Una noche.<br>Mil sustos.<br><span>Un disfraz ganador.</span></h1><p class="hero-copy">Descubre los disfraces de tus amigos y vota por tus favoritos. Que gane el más perrote.</p><div class="hero-actions"><button class="primary" data-page="add">＋ Registrar disfraz</button><button class="secondary" data-page="list">Ver disfraces →</button></div></section>
  <div class="section-heading"><div><h2>¿Cómo funciona?</h2><p>Sigue estos pasos: </p></div></div>
  <div class="feature-grid"><article class="feature"><span class="emoji">🪪</span><h3>1. Crea tu perfil</h3><p>Elige el nombre con el que te conocerán durante el concurso. Sin correo ni verificación.</p></article><article class="feature"><span class="emoji">🧛</span><h3>2. Sube tu disfraz</h3><p>Agrega el nombre de tu transformación y una descripción para presumirla.</p></article><article class="feature"><span class="emoji">🗳️</span><h3>3. Vota con cuidado</h3><p>Puedes votar una vez por cada disfraz distinto. Los votos no se muestran al público.</p></article></div>
  <section class="panel" style="margin-top:18px"><div class="profile-row"><div class="avatar">${name ? "👻" : "🎭"}</div><div><h2>${name ? `Qué onda, ${escapeHtml(name)}` : "¿Listo para entrar al concurso?"}</h2><p>${name ? "Tu perfil está guardado en este navegador." : "Primero crea un perfil rápido para poder registrar tu disfraz."}</p></div></div><div class="hero-actions" style="margin-top:12px"><button class="primary" data-page="profile">${name ? "Editar mi perfil" : "Crear mi perfil"}</button>${name ? `<button class="secondary" data-page="add">Registrar mi disfraz</button>` : ""}</div>${adminArea}</section>`;
}

function renderProfile() {
  const name = profile?.display_name || "";
  return `${pageHead("TU IDENTIDAD EN LA FIESTA", "Mi perfil", "Usa un nombre que tus amigos reconozcan. No se pide correo ni confirmación.")}
  <section class="panel"><div class="profile-row"><div class="avatar">👻</div><div><h2>${name ? escapeHtml(name) : "Perfil sin configurar"}</h2><p>${profile?.is_admin ? "Cuenta de administrador" : "Participante del concurso"}</p></div></div>
  <form id="profile-form"><div class="field"><label for="display-name">Nombre o apodo</label><input id="display-name" name="display_name" maxlength="40" value="${escapeHtml(name)}" placeholder="Ej. La Bruja del 404" required><small>Máximo 40 caracteres. Este nombre se mostrará junto a tu disfraz.</small></div><button class="primary" type="submit">Guardar perfil</button></form>
  <div class="profile-details"><div class="profile-stat"><span>Estado del perfil</span><strong>${name ? "✅ Configurado" : "⚠️ Falta tu nombre"}</strong></div><div class="profile-stat"><span>Sesión</span><strong>Sin correo electrónico</strong></div></div><p class="form-note">Importante: tu perfil anónimo queda ligado a este navegador. No borres sus datos ni cambies de dispositivo durante el concurso o el sistema podría reconocerte como otro participante.</p></section>`;
}

async function renderAdd() {
  const costumes = await loadCostumes();
  const mine = costumes.find(costume => costume.owner_id === currentUser.id);
  if (!profile?.display_name?.trim()) {
    return `${pageHead("ANTES DE SUBIR AL ESCENARIO", "Primero crea tu perfil", "Necesitamos tu nombre para asociarlo con tu disfraz.")}
      <section class="empty-state"><div class="emoji">🪪</div><h3>Tu personaje necesita un nombre</h3><p>Crea un perfil rápido. No necesitas correo electrónico ni contraseña.</p><button class="primary" data-page="profile">Crear mi perfil</button></section>`;
  }
  if (mine) {
    return `${pageHead("TU DISFRAZ", "Ya estás en la lista", "Cada perfil puede registrar un solo disfraz para mantener el concurso ordenado.")}
      <section class="panel"><div class="status-strip">Tu disfraz ya está registrado. Aparecerá resaltado en la lista pública con la etiqueta “Este es tu disfraz”.</div>${costumeCard(mine, new Set(), true)}<div class="hero-actions"><button class="secondary" data-page="list">Ir a la lista</button></div></section>`;
  }
  return `${pageHead("ENTRA EN ESCENA", "Registra tu disfraz", `Participante: <strong>${escapeHtml(profile.display_name)}</strong>. ¡Haz que ese nombre se vuelva leyenda!`)}
    <section class="panel"><form id="costume-form"><div class="field"><label for="costume-name">Nombre del disfraz</label><input id="costume-name" name="costume_name" maxlength="100" placeholder="Ej. Payaso del inframundo" required></div><div class="field"><label for="costume-description">Descripción (opcional)</label><textarea id="costume-description" name="description" maxlength="500" placeholder="Cuenta qué eres, cómo lo hiciste o cuál es el detalle más terrorífico..."></textarea><small>Máximo 500 caracteres. Por ahora no se suben fotografías.</small></div><button class="primary" type="submit">🎃 Registrar mi disfraz</button><p class="form-note">Solo puedes registrar un disfraz por perfil. El nombre de tu perfil se usará como participante.</p></form></section>`;
}

function costumeCard(costume, votedIds, showOwner = false) {
  const mine = costume.owner_id === currentUser.id;
  const voted = votedIds.has(costume.id);
  const description = costume.description?.trim() ? escapeHtml(costume.description) : "Sin descripción.";
  let action = "";
  if (mine) action = `<button class="vote-btn" disabled>Tu disfraz</button>`;
  else if (voted) action = `<button class="vote-btn voted" disabled>✓ Ya votaste</button>`;
  else action = `<button class="vote-btn" data-vote="${costume.id}">♡ Votar</button>`;
  const ownerName = mine ? (profile?.display_name || costume.display_name || "Tú") : (costume.display_name || "Participante");
  return `<article class="costume-card ${mine ? "mine" : ""}">${mine ? `<span class="mine-tag">✦ ESTE ES TU DISFRAZ</span>` : ""}<h3>${escapeHtml(costume.costume_name)}</h3><p class="costume-owner">🎭 ${escapeHtml(ownerName)}</p><div class="costume-description">${description}</div><div class="card-footer"><small>Los votos son privados</small>${action}</div></article>`;
}

async function renderList() {
  const [costumes, myVotes] = await Promise.all([loadCostumes(), loadMyVotes()]);
  const normalized = costumes;
  if (!normalized.length) {
    return `${pageHead("EL ESCENARIO ESTÁ VACÍO", "Disfraces y votos", "La lista aparecerá aquí en cuanto alguien registre su atuendo.")}
    <section class="empty-state"><div class="emoji">🦇</div><h3>¡Sé el primero en participar!</h3><p>El primer disfraz puede romper el hielo. Regístralo y anima a los demás a sumarse.</p><button class="primary" data-page="add">Agregar primer disfraz</button></section>`;
  }
  return `${pageHead("EL CATÁLOGO DE LA NOCHE", "Disfraces y votos", "Explora todos los participantes. Puedes votar por varios disfraces distintos, pero solo una vez por cada uno.")}
    <div class="status-strip">🔒 La cantidad de votos no se muestra. Cada voto es privado y solo el administrador puede consultar el conteo total.</div><div class="costume-grid">${normalized.map(costume => costumeCard(costume, myVotes, true)).join("")}</div>`;
}

async function renderResults() {
  if (!settings.results_enabled) {
    return `${pageHead("EL SOBRE SIGUE CERRADO", "Resultados", "El anfitrión todavía no ha abierto los resultados.")}<section class="empty-state"><div class="emoji">🔒</div><h3>Los resultados están cerrados</h3><p>Vuelve más tarde cuando la persona organizadora active esta pestaña.</p></section>`;
  }
  if (!profile?.is_admin) {
    return `${pageHead("EL SOBRE SIGUE CERRADO", "Resultados", "Esta pestaña ya fue activada por el anfitrión.")}<section class="empty-state"><div class="emoji">🕵️</div><h3>Conteo reservado</h3><p>La pestaña está abierta, pero el conteo de votos es privado y solo puede consultarlo el administrador.</p></section>`;
  }
  const [costumes, votesResult] = await Promise.all([
    loadCostumes(),
    db.from("votes").select("costume_id")
  ]);
  if (votesResult.error) throw votesResult.error;
  const counts = new Map();
  (votesResult.data || []).forEach(vote => counts.set(vote.costume_id, (counts.get(vote.costume_id) || 0) + 1));
  const totalVotes = (votesResult.data || []).length;
  const sorted = costumes.map(costume => ({ ...costume, votes: counts.get(costume.id) || 0 }))
    .sort((a, b) => b.votes - a.votes || a.costume_name.localeCompare(b.costume_name, "es"));
  const max = Math.max(1, ...sorted.map(item => item.votes));
  const items = sorted.length ? sorted.map((item, index) => `<div class="result-row"><div class="result-top"><strong>${index === 0 && item.votes > 0 ? "🏆 " : ""}${escapeHtml(item.costume_name)}</strong><span>${item.votes} ${item.votes === 1 ? "voto" : "votos"}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(item.votes > 0 ? 3 : 0, item.votes / max * 100)}%"></div></div></div>`).join("") : `<p class="muted">Todavía no hay disfraces registrados.</p>`;
  return `${pageHead("PANEL PRIVADO DEL ANFITRIÓN", "Resultados del concurso", "Este conteo se obtiene directamente de la base de datos y no está disponible para participantes normales.")}
    <section class="panel"><div class="profile-details"><div class="profile-stat"><span>Votos emitidos</span><strong>${totalVotes}</strong></div><div class="profile-stat"><span>Disfraces participantes</span><strong>${costumes.length}</strong></div></div><div class="results-list">${items}</div><div class="admin-actions"><button class="secondary" id="toggle-results">Ocultar pestaña de resultados</button></div></section>`;
}

async function render() {
  resultsTab.style.display = settings.results_enabled ? "inline-flex" : "none";
  document.querySelectorAll("[data-page]").forEach(button => {
    if (button.classList.contains("nav-btn")) button.classList.toggle("active", button.dataset.page === currentPage);
  });
  app.innerHTML = `<section class="loading-panel"><span class="moon">🌙</span><p>Preparando la noche...</p></section>`;
  try {
    if (currentPage === "home") app.innerHTML = renderHome();
    else if (currentPage === "profile") app.innerHTML = renderProfile();
    else if (currentPage === "add") app.innerHTML = await renderAdd();
    else if (currentPage === "list") app.innerHTML = await renderList();
    else if (currentPage === "results") app.innerHTML = await renderResults();
    bindPageActions();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="panel"><h2>No pudimos cargar esta sección</h2><p class="muted">${escapeHtml(errorMessage(error))}</p><button class="secondary" id="retry">Intentar de nuevo</button></section>`;
    document.getElementById("retry")?.addEventListener("click", () => render());
  }
}

async function goTo(page) {
  if (page === "results" && !settings.results_enabled) return;
  currentPage = page;
  adminLoginOpen = false;
  await render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveProfile(form) {
  const data = new FormData(form);
  const displayName = String(data.get("display_name") || "").trim();
  if (!displayName) return showToast("Escribe tu nombre o apodo.", "error");
  const { error } = await db.from("participants").update({ display_name: displayName }).eq("id", currentUser.id);
  if (error) return showToast(errorMessage(error), "error");
  await loadProfile();
  showToast("Perfil guardado. ¡Ya estás en la lista de la noche!", "success");
  currentPage = "profile";
  await render();
}

async function saveCostume(form) {
  if (!profile?.display_name?.trim()) {
    currentPage = "profile";
    await render();
    return showToast("Primero guarda tu nombre en Mi perfil.", "error");
  }
  const data = new FormData(form);
  const costumeName = String(data.get("costume_name") || "").trim();
  const description = String(data.get("description") || "").trim();
  if (!costumeName) return showToast("Ponle un nombre a tu disfraz.", "error");
  const { error } = await db.from("costumes").insert({
    owner_id: currentUser.id,
    costume_name: costumeName,
    description
  });
  if (error) return showToast(errorMessage(error), "error");
  showToast("¡Disfraz registrado! Ya puedes buscar a tus rivales.", "success");
  currentPage = "list";
  await render();
}

async function castVote(costumeId) {
  const { error } = await db.from("votes").insert({ voter_id: currentUser.id, costume_id: costumeId });
  if (error) {
    showToast(error.code === "23505" ? "Ya votaste por este disfraz." : errorMessage(error), "error");
    return;
  }
  showToast("¡Voto registrado! La cuenta sigue siendo privada.", "success");
  await render();
}

async function toggleResults() {
  if (!profile?.is_admin) return showToast("Solo el administrador puede cambiar esta opción.", "error");
  const { data, error } = await db.from("event_settings")
    .update({ results_enabled: !settings.results_enabled }).eq("id", 1)
    .select("id, results_enabled").single();
  if (error) return showToast(errorMessage(error), "error");
  settings = data;
  resultsTab.style.display = settings.results_enabled ? "inline-flex" : "none";
  if (!settings.results_enabled && currentPage === "results") currentPage = "home";
  showToast(settings.results_enabled ? "Pestaña de resultados activada." : "Pestaña de resultados oculta.", "success");
  await render();
}


async function adminLogin(form) {
  const emailInput = form.querySelector("#admin-email");
  const passwordInput = form.querySelector("#admin-password");

  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    console.error("Formulario incompleto:", {
      emailFound: Boolean(emailInput),
      passwordFound: Boolean(passwordInput),
      emailPresent: Boolean(email),
      passwordPresent: Boolean(password)
    });

    showToast("No se encontró el correo o la contraseña.", "error");
    return;
  }

  console.log("Intentando iniciar sesión:", {
    email,
    passwordPresent: Boolean(password)
  });

  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    console.error("Error real de Supabase:", {
      message: error.message,
      status: error.status,
      code: error.code
    });

    showToast(`Error: ${error.message}`, "error");
    return;
  }

  currentUser = data.user;

  try {
    await loadProfile();

    if (!profile?.is_admin) {
      showToast(
        "Inicio de sesión correcto, pero este usuario no tiene permisos de administrador.",
        "error"
      );
      return;
    }

    await loadSettings();

    adminLoginOpen = false;
    currentPage = "home";

    showToast("¡Acceso de administrador concedido!", "success");
    await render();
  } catch (err) {
    console.error("Error cargando el perfil:", err);
    showToast(
      `Error al cargar el perfil: ${err.message}`,
      "error"
    );
  }
}


function bindPageActions() {
  app.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.page)));
  app.querySelector("#profile-form")?.addEventListener("submit", async event => {
    event.preventDefault(); await saveProfile(event.currentTarget);
  });
  app.querySelector("#costume-form")?.addEventListener("submit", async event => {
    event.preventDefault(); await saveCostume(event.currentTarget);
  });
  app.querySelectorAll("[data-vote]").forEach(button => button.addEventListener("click", () => castVote(button.dataset.vote)));
  app.querySelector("#toggle-results")?.addEventListener("click", toggleResults);
  app.querySelector("#go-results")?.addEventListener("click", () => goTo("results"));
  app.querySelector("#show-admin-login")?.addEventListener("click", async () => {
    adminLoginOpen = !adminLoginOpen; await render();
  });
  app.querySelector("#admin-login-form")?.addEventListener("submit", async event => {
    event.preventDefault(); await adminLogin(event.currentTarget);
  });
}

document.getElementById("nav").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (button) goTo(button.dataset.page);
});
document.querySelector(".brand").addEventListener("click", event => {
  event.preventDefault(); goTo("home");
});

async function boot() {
  if (SUPABASE_URL.includes("TU-PROYECTO") || SUPABASE_ANON_KEY.includes("TU_PUBLISHABLE")) {
    app.innerHTML = `<section class="panel"><h2>Solo falta conectar Supabase</h2><p class="muted">Abre <code>app.js</code> y sustituye <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> por los datos de tu proyecto. Después ejecuta <code>setup.sql</code> en el SQL Editor de Supabase.</p></section>`;
    return;
  }
  try {
    let { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error) throw error;
      currentUser = data.user;
    } else {
      currentUser = sessionData.session.user;
    }
    if (!currentUser) throw new Error("No se pudo iniciar la sesión del participante.");
    await loadProfile();
    await loadSettings();
    await render();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="panel"><h2>No se pudo conectar con el concurso</h2><p class="muted">${escapeHtml(errorMessage(error))}</p><p class="form-note">Revisa que habilitaste los accesos anónimos en Supabase, ejecutaste <code>setup.sql</code> y pegaste las credenciales correctas.</p></section>`;
  }
}

boot();
