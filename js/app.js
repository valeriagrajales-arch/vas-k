/* =========================================================
   VAS-K · Lógica de la tienda (JavaScript puro, sin librerías)
   - Catálogo: una sola tarta vasca en tres tamaños (Vas-kita, Vas-k, Vas-kota);
     toppings y salsas opcionales al personalizar
   - Favoritos  (botón ♡ y corazón del encabezado)
   - Bolsa de compras (icono de la bolsa)
   - Registro / inicio de sesión (cuenta opcional, no es necesaria para pedir)
   - Pedido: el botón Comprar abre WhatsApp con el detalle de la bolsa
   Los datos se guardan en localStorage (el navegador).
   ========================================================= */

/* ---------- 1. DATOS ---------- */
// Hay un solo sabor de tarta: lo que cambia es el tamaño (obligatorio).
// Los toppings y las salsas son opcionales y se eligen al personalizar.
const PRODUCTOS = [
  { id: "vaskita", nombre: "Vas-kita", precio: 13000, img: "img/tarta-en-caja.jpg", etiqueta: "PEQUEÑA",
    descripcion: "Nuestra tarta vasca en tamaño individual." },
  { id: "vask", nombre: "Vas-k", precio: 32000, img: "img/tartas-tres-tamanos-1.jpg", etiqueta: "MEDIANA",
    descripcion: "El tamaño ideal para compartir." },
  { id: "vaskota", nombre: "Vas-kota", precio: 43000, img: "img/tartas-tres-tamanos-2.jpg", etiqueta: "GRANDE",
    descripcion: "La más grande, perfecta para celebrar." },
];

// Reglas de los extras (opcionales). Cambia estos valores si cambian los precios o los límites.
const MAX_TOPPINGS = 2;      // máximo de toppings por tarta (sin costo adicional)
const MAX_SALSAS = 2;        // máximo de salsas por tarta
const PRECIO_SALSA = 1000;   // costo adicional por cada salsa

// tipo: "topping" o "salsa".
const TOPPINGS = [
  { id: "arandanos", tipo: "topping", nombre: "Arándanos" },
  { id: "fresas", tipo: "topping", nombre: "Fresas" },
  { id: "oreo", tipo: "topping", nombre: "Oreo" },
  { id: "mani", tipo: "topping", nombre: "Maní" },
  { id: "chips-blanco", tipo: "topping", nombre: "Chips de chocolate blanco" },
  { id: "chips-negro", tipo: "topping", nombre: "Chips de chocolate negro" },
  { id: "pistacho-picado", tipo: "topping", nombre: "Pistacho picado" },
  { id: "salsa-chocolate", tipo: "salsa", nombre: "Chocolate" },
  { id: "salsa-arequipe", tipo: "salsa", nombre: "Arequipe" },
  { id: "salsa-mora", tipo: "salsa", nombre: "Mora" },
  { id: "salsa-fresa", tipo: "salsa", nombre: "Mermelada de fresa" },
  { id: "salsa-pistacho", tipo: "salsa", nombre: "Pistacho" },
];

const COSTO_ENVIO = 8000;
const WHATSAPP = "573004913966"; // número que recibe los pedidos

/* ---------- 2. UTILIDADES ---------- */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-CO");

const guardar = (clave, valor) => localStorage.setItem("vask_" + clave, JSON.stringify(valor));
const leer = (clave, porDefecto) => {
  try { return JSON.parse(localStorage.getItem("vask_" + clave)) ?? porDefecto; }
  catch { return porDefecto; }
};

// Evita que texto escrito por el usuario se interprete como HTML
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Guarda la contraseña cifrada (SHA-256), nunca en texto plano
async function cifrar(texto) {
  if (window.crypto?.subtle) {
    const datos = new TextEncoder().encode(texto);
    const hash = await crypto.subtle.digest("SHA-256", datos);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(texto)));
}

function aviso(mensaje) {
  const t = document.createElement("div");
  t.className = "vk-toast";
  t.textContent = mensaje;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("visible"), 10);
  setTimeout(() => { t.classList.remove("visible"); setTimeout(() => t.remove(), 300); }, 2500);
}

/* ---------- 3. ESTADO ---------- */
const producto = (id) => PRODUCTOS.find((p) => p.id === id);
const nombreExtra = (id) => TOPPINGS.find((x) => x.id === id)?.nombre ?? id;

// Se descartan datos viejos guardados en el navegador que ya no existen en el catálogo
let favoritos = leer("favoritos", []).filter(producto);                       // ids de productos
let bolsa = leer("bolsa", []).filter((i) => i.productoId && producto(i.productoId)); // [{ uid, productoId, toppings[], cantidad }]
let usuarios = leer("usuarios", []);       // [{ nombre, email, telefono, direccion, clave }]
let sesion = leer("sesion", null);         // email del usuario conectado
let pedidos = leer("pedidos", []);

const usuarioActual = () => usuarios.find((u) => u.email === sesion) || null;

// Precio = tamaño + salsas elegidas (los toppings no tienen costo adicional)
const tipoExtra = (id) => TOPPINGS.find((x) => x.id === id)?.tipo;
const precioUnidad = (item) =>
  producto(item.productoId).precio + item.toppings.filter((t) => tipoExtra(t) === "salsa").length * PRECIO_SALSA;
const precioItem = (item) => precioUnidad(item) * item.cantidad;
const subtotal = () => bolsa.reduce((s, i) => s + precioItem(i), 0);

/* ---------- 4. VENTANAS (modales) ---------- */
function abrirModal(html, clase = "") {
  cerrarModal();
  const fondo = document.createElement("div");
  fondo.className = "vk-fondo";
  fondo.innerHTML = `<div class="vk-modal ${clase}" role="dialog" aria-modal="true">
      <button class="vk-cerrar" aria-label="Cerrar">×</button>${html}</div>`;
  fondo.addEventListener("click", (e) => {
    if (e.target === fondo || e.target.classList.contains("vk-cerrar")) cerrarModal();
  });
  document.body.appendChild(fondo);
  document.body.style.overflow = "hidden";
  return $(".vk-modal", fondo);
}
function cerrarModal() {
  $(".vk-fondo")?.remove();
  document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => e.key === "Escape" && cerrarModal());

/* ---------- 5. ENCABEZADO: contadores y botón de cuenta ---------- */
function prepararEncabezado() {
  const compras = $(".compras");
  if (!compras) return;
  const [corazon, bolso] = $$("img", compras);

  const envolver = (img, id, etiqueta, accion) => {
    const btn = document.createElement("button");
    btn.className = "vk-icono";
    btn.id = id;
    btn.setAttribute("aria-label", etiqueta);
    img.replaceWith(btn);
    btn.append(img, Object.assign(document.createElement("span"), { className: "vk-contador" }));
    btn.addEventListener("click", accion);
  };
  envolver(corazon, "btn-favoritos", "Favoritos", abrirFavoritos);
  envolver(bolso, "btn-bolsa", "Bolsa de compras", abrirBolsa);

  const cuenta = document.createElement("button");
  cuenta.id = "btn-cuenta";
  cuenta.className = "vk-cuenta";
  cuenta.addEventListener("click", () => (usuarioActual() ? abrirCuenta() : abrirAcceso("entrar")));
  compras.prepend(cuenta);

  actualizarEncabezado();
}

function actualizarEncabezado() {
  const fav = $("#btn-favoritos .vk-contador");
  const bol = $("#btn-bolsa .vk-contador");
  const nBolsa = bolsa.reduce((s, i) => s + i.cantidad, 0);
  if (fav) { fav.textContent = favoritos.length; fav.hidden = !favoritos.length; }
  if (bol) { bol.textContent = nBolsa; bol.hidden = !nBolsa; }
  const cuenta = $("#btn-cuenta");
  if (cuenta) {
    const u = usuarioActual();
    cuenta.textContent = u ? "Hola, " + u.nombre.split(" ")[0] : "Ingresar";
  }
  // Corazones de las tarjetas
  $$("[data-fav]").forEach((b) => {
    const activo = favoritos.includes(b.dataset.fav);
    b.textContent = activo ? "♥" : "♡";
    b.classList.toggle("activo", activo);
  });
}

/* ---------- 6. CATÁLOGO ---------- */
function tarjeta(s) {
  return `<div class="pasteles vk-tarjeta">
      <img src="${s.img}" alt="${s.nombre}">
      <span>${s.etiqueta}</span>
      <button data-fav="${s.id}" aria-label="Agregar a favoritos">♡</button>
      <div class="textopasteles">
        <p>${s.nombre}</p>
        <p>${pesos(s.precio)}</p>
        <p>${s.descripcion}</p>
        <p><a href="#" data-personalizar="${s.id}">Personalizar</a></p>
      </div>
    </div>`;
}

function pintarCatalogo() {
  // Página de inicio: .productos   ·   Página de productos: .produ
  const destino = $(".productos") || $(".produ");
  if (!destino) return;
  destino.classList.add("vk-catalogo");
  destino.innerHTML = PRODUCTOS.map(tarjeta).join("");
}

// Delegación de eventos: un solo "escuchador" para todos los botones
document.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) return alternarFavorito(fav.dataset.fav);

  const pers = e.target.closest("[data-personalizar]");
  if (pers) { e.preventDefault(); return abrirPersonalizar(pers.dataset.personalizar); }
});

/* ---------- 7. FAVORITOS ---------- */
function alternarFavorito(id) {
  if (favoritos.includes(id)) {
    favoritos = favoritos.filter((f) => f !== id);
    aviso("Quitado de favoritos");
  } else {
    favoritos.push(id);
    aviso("♥ Agregado a favoritos");
  }
  guardar("favoritos", favoritos);
  actualizarEncabezado();
  if ($(".vk-modal.favs")) abrirFavoritos();
}

function abrirFavoritos() {
  const lista = favoritos.map(producto).filter(Boolean);
  abrirModal(`<h2>Tus favoritos</h2>
    ${lista.length ? lista.map((s) => `
      <div class="vk-fila">
        <img src="${s.img}" alt="">
        <div><b>${s.nombre}</b><small>${pesos(s.precio)}</small></div>
        <button class="vk-btn" data-personalizar="${s.id}">Personalizar</button>
        <button class="vk-link" data-fav="${s.id}">Quitar</button>
      </div>`).join("") : `<p class="vk-vacio">Aún no tienes favoritos. Toca el ♡ de una tarta.</p>`}`, "favs");
}

/* ---------- 8. PERSONALIZAR (tamaño obligatorio · toppings y salsas opcionales · cantidad) ---------- */
function abrirPersonalizar(id) {
  const p = producto(id);
  const grupo = (tipo, titulo, max, nota) => `
        <h3>${titulo} <small>(opcional, hasta ${max}${nota})</small></h3>
        <div class="vk-toppings">${TOPPINGS.filter((t) => t.tipo === tipo).map((t) => `<label class="vk-opcion">
          <input type="checkbox" name="topping" data-tipo="${tipo}" value="${t.id}"> ${t.nombre}</label>`).join("")}
        </div>`;

  const modal = abrirModal(`
    <div class="vk-personalizar">
      <img id="img-personalizar" src="${p.img}" alt="">
      <form id="form-personalizar">
        <h2>Tu tarta vasca</h2>
        <p class="vk-sub">Elige el tamaño y, si quieres, agrégale toppings y salsas.</p>

        <h3>Tamaño <small>(obligatorio)</small></h3>
        ${PRODUCTOS.map((x) => `<label class="vk-opcion">
          <input type="radio" name="tamano" value="${x.id}" ${x.id === id ? "checked" : ""}>
          ${x.nombre} · ${x.etiqueta.toLowerCase()} · ${pesos(x.precio)}</label>`).join("")}

        ${grupo("topping", "Toppings", MAX_TOPPINGS, ", sin costo")}
        ${grupo("salsa", "Salsas", MAX_SALSAS, ` · +${pesos(PRECIO_SALSA)} c/u`)}

        <h3>Cantidad</h3>
        <input type="number" name="cantidad" min="1" max="20" value="1">

        <p class="vk-error" id="error-personalizar"></p>
        <button class="vk-btn grande" type="submit">Agregar a la bolsa · <span id="precio-vivo"></span></button>
      </form>
    </div>`, "ancho");

  const form = $("#form-personalizar", modal);
  const maximos = { topping: MAX_TOPPINGS, salsa: MAX_SALSAS };
  const marcados = (tipo) => $$(`[data-tipo="${tipo}"]:checked`, form);
  const leerForm = () => ({
    productoId: form.tamano.value,
    toppings: $$("[name=topping]:checked", form).map((c) => c.value),
    cantidad: Math.max(1, Math.min(20, parseInt(form.cantidad.value) || 1)),
  });
  const refrescar = () => {
    // Al llegar al límite de cada grupo, se bloquean las demás opciones
    Object.entries(maximos).forEach(([tipo, max]) => {
      const lleno = marcados(tipo).length >= max;
      $$(`[data-tipo="${tipo}"]:not(:checked)`, form).forEach((c) => (c.disabled = lleno));
    });
    const item = leerForm();
    $("#img-personalizar", modal).src = producto(item.productoId).img;
    $("#precio-vivo", modal).textContent = pesos(precioItem(item));
  };
  form.addEventListener("input", refrescar);
  refrescar();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.tamano.value) {
      $("#error-personalizar", modal).textContent = "Elige un tamaño.";
      return;
    }
    agregarABolsa(leerForm());
  });
}

/* ---------- 9. BOLSA ---------- */
function agregarABolsa(item) {
  // Si ya existe la misma combinación, solo sumamos la cantidad
  const clave = (i) => i.productoId + [...i.toppings].sort().join();
  const igual = bolsa.find((i) => clave(i) === clave(item));
  if (igual) igual.cantidad += item.cantidad;
  else bolsa.push({ uid: Date.now().toString(36), ...item });
  guardar("bolsa", bolsa);
  actualizarEncabezado();
  aviso("Agregado a la bolsa");
  abrirBolsa();
}

function abrirBolsa() {
  const modal = abrirModal(`<h2>Tu bolsa</h2>
    ${bolsa.length ? `
      ${bolsa.map((i) => {
        const p = producto(i.productoId);
        const lista = (tipo) => i.toppings.filter((t) => tipoExtra(t) === tipo).map(nombreExtra).join(", ");
        const tops = lista("topping"), sals = lista("salsa");
        return `<div class="vk-fila">
          <img src="${p.img}" alt="">
          <div><b>${p.nombre}</b>${tops ? `<small>Toppings: ${tops}</small>` : ""}${sals ? `<small>Salsas: ${sals}</small>` : ""}</div>
          <div class="vk-cantidad">
            <button data-menos="${i.uid}">−</button><span>${i.cantidad}</span><button data-mas="${i.uid}">+</button>
          </div>
          <b>${pesos(precioItem(i))}</b>
          <button class="vk-link" data-quitar="${i.uid}">Quitar</button>
        </div>`;
      }).join("")}
      <div class="vk-total"><span>Subtotal</span><b>${pesos(subtotal())}</b></div>
      <button class="vk-btn grande" id="btn-comprar">Pedir por WhatsApp</button>`
    : `<p class="vk-vacio">Tu bolsa está vacía.</p>`}`);

  modal.addEventListener("click", (e) => {
    const id = e.target.dataset.mas || e.target.dataset.menos || e.target.dataset.quitar;
    if (id) {
      const item = bolsa.find((i) => i.uid === id);
      if (e.target.dataset.mas) item.cantidad++;
      if (e.target.dataset.menos) item.cantidad--;
      if (e.target.dataset.quitar || item.cantidad < 1) bolsa = bolsa.filter((i) => i.uid !== id);
      guardar("bolsa", bolsa);
      actualizarEncabezado();
      abrirBolsa();
    }
    if (e.target.id === "btn-comprar") pedirPorWhatsApp();
  });
}

/* ---------- 10. REGISTRO E INICIO DE SESIÓN ---------- */
function abrirAcceso(modo, despues) {
  const registro = modo === "registro";
  const modal = abrirModal(`
    <h2>${registro ? "Crear cuenta" : "Ingresar"}</h2>
    <form id="form-acceso" class="vk-form" novalidate>
      ${registro ? `
        <label>Nombre completo<input name="nombre" required minlength="3"></label>
        <label>Teléfono<input name="telefono" type="tel" required pattern="[0-9 +]{7,15}" placeholder="300 123 4567"></label>
        <label>Dirección de entrega<input name="direccion" required minlength="5" placeholder="Calle 10 # 20-30, Bogotá"></label>` : ""}
      <label>Correo<input name="email" type="email" required></label>
      <label>Contraseña<input name="clave" type="password" required minlength="6"></label>
      <p class="vk-error" id="error-acceso"></p>
      <button class="vk-btn grande" type="submit">${registro ? "Registrarme" : "Entrar"}</button>
      <p class="vk-sub">${registro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}
        <a href="#" id="cambiar-modo">${registro ? "Ingresa" : "Regístrate"}</a></p>
    </form>`);

  $("#cambiar-modo", modal).addEventListener("click", (e) => {
    e.preventDefault();
    abrirAcceso(registro ? "entrar" : "registro", despues);
  });

  const form = $("#form-acceso", modal);
  const error = $("#error-acceso", modal);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      const malo = $$("input", form).find((i) => !i.checkValidity());
      error.textContent = "Revisa el campo: " + malo.parentElement.firstChild.textContent.trim();
      return malo.focus();
    }
    const datos = Object.fromEntries(new FormData(form));
    datos.email = datos.email.trim().toLowerCase();
    const clave = await cifrar(datos.clave);

    if (registro) {
      if (usuarios.some((u) => u.email === datos.email)) {
        error.textContent = "Ese correo ya está registrado.";
        return;
      }
      usuarios.push({ nombre: datos.nombre.trim(), email: datos.email,
        telefono: datos.telefono.trim(), direccion: datos.direccion.trim(), clave });
      guardar("usuarios", usuarios);
    } else {
      const u = usuarios.find((x) => x.email === datos.email);
      if (!u || u.clave !== clave) {
        error.textContent = "Correo o contraseña incorrectos.";
        return;
      }
    }
    sesion = datos.email;
    guardar("sesion", sesion);
    actualizarEncabezado();
    aviso("Bienvenido, " + usuarioActual().nombre.split(" ")[0]);
    despues ? despues() : cerrarModal();
  });
}

function abrirCuenta() {
  const u = usuarioActual();
  const mios = pedidos.filter((p) => p.email === u.email);
  const modal = abrirModal(`<h2>Mi cuenta</h2>
    <p><b>${escapar(u.nombre)}</b><br>${escapar(u.email)}<br>${escapar(u.telefono)}<br>${escapar(u.direccion)}</p>
    <h3>Mis pedidos</h3>
    ${mios.length ? mios.map((p) => `<div class="vk-total"><span>#${p.numero} · ${p.fecha}</span><b>${pesos(p.total)}</b></div>`).join("")
      : `<p class="vk-vacio">Todavía no has hecho pedidos.</p>`}
    <button class="vk-btn" id="btn-salir">Cerrar sesión</button>`);
  $("#btn-salir", modal).addEventListener("click", () => {
    sesion = null;
    guardar("sesion", null);
    actualizarEncabezado();
    cerrarModal();
    aviso("Sesión cerrada");
  });
}

/* ---------- 11. PEDIDO POR WHATSAPP ---------- */
// Arma el mensaje con el detalle de la bolsa y abre el chat de WhatsApp de la tienda.
function mensajeWhatsApp() {
  const lineas = bolsa.map((i, n) => {
    const p = producto(i.productoId);
    const lista = (tipo) => i.toppings.filter((t) => tipoExtra(t) === tipo).map(nombreExtra).join(", ");
    const tops = lista("topping"), sals = lista("salsa");
    return `${n + 1}. ${i.cantidad} x ${p.nombre} (${p.etiqueta.toLowerCase()})\n` +
      `   Toppings: ${tops || "sin toppings"}\n` +
      `   Salsas: ${sals || "sin salsas"}\n` +
      `   Valor: ${pesos(precioItem(i))}`;
  });
  return [
    "¡Hola Vas-k! Quiero hacer este pedido:",
    "",
    ...lineas.flatMap((l) => [l, ""]),
    `Subtotal: ${pesos(subtotal())}`,
    `Envío: ${pesos(COSTO_ENVIO)}`,
    `Total: ${pesos(subtotal() + COSTO_ENVIO)}`,
    "",
    "Mis datos de entrega:",
    "Nombre:",
    "Dirección:",
    "Fecha de entrega:",
  ].join("\n");
}

function pedirPorWhatsApp() {
  if (!bolsa.length) return aviso("Tu bolsa está vacía");
  const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensajeWhatsApp())}`;
  window.open(url, "_blank", "noopener");
}

/* ---------- 12. ARRANQUE ---------- */
document.addEventListener("DOMContentLoaded", () => {
  pintarCatalogo();
  prepararEncabezado();
  // Los botones "Descubre tu tarta" y "Ver todo el menú" llevan a productos
  $$(".descubre, .botonformas a").forEach((a) => (a.href = "productos.html"));
  $$(".conoce").forEach((a) => (a.href = "historia.html"));
  $$(".insta a").forEach((a) => { a.href = "https://instagram.com/"; a.target = "_blank"; });
});
