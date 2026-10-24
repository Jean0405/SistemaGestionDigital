// Utilidades de la página: llamadas a la API, sesión guardada y pintado seguro de HTML.

/** Estado compartido entre las vistas. El token vive solo en esta pestaña del navegador. */
export const estado = {
  config: null,
  token: leerSesion('sgid.token'),
  perfil: null,
  avisos: JSON.parse(leerSesion('sgid.avisos') ?? 'null'),
  /** Si la persona llegó desde un servicio del Estado: { clientId, redirectUri, state, servicio }. */
  autorizacion: null,
};

function leerSesion(clave) {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarSesion(token, avisos) {
  estado.token = token;
  estado.avisos = avisos ?? null;
  try {
    if (token) {
      sessionStorage.setItem('sgid.token', token);
      sessionStorage.setItem('sgid.avisos', JSON.stringify(avisos ?? null));
    } else {
      sessionStorage.removeItem('sgid.token');
      sessionStorage.removeItem('sgid.avisos');
    }
  } catch {
    // sin almacenamiento disponible: la sesión dura hasta recargar la página
  }
}

/** Llama a la API y devuelve { ok, status, datos } sin lanzar error por respuestas 4xx/5xx. */
export async function api(metodo, ruta, cuerpo, token = estado.token) {
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  return { ok: respuesta.ok, status: respuesta.status, datos };
}

// --- HTML seguro: todo lo que se interpola se escapa, salvo otro bloque h`` ---

class HtmlSeguro {
  constructor(texto) {
    this.texto = texto;
  }
  toString() {
    return this.texto;
  }
}

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function interpolar(valor) {
  if (valor instanceof HtmlSeguro) return valor.texto;
  if (Array.isArray(valor)) return valor.map(interpolar).join('');
  if (valor === null || valor === undefined || valor === false) return '';
  return esc(valor);
}

export function h(partes, ...valores) {
  return new HtmlSeguro(partes.reduce((acc, parte, i) => acc + parte + (i < valores.length ? interpolar(valores[i]) : ''), ''));
}

/** Reemplaza el contenido de un elemento. Acepta bloques h``, listas de bloques o texto (que se escapa). */
export function pintar(elemento, contenido) {
  elemento.innerHTML = interpolar(contenido);
  dibujarIconos();
}

/** Convierte los <i data-lucide="..."> en iconos SVG de Lucide. */
export function dibujarIconos() {
  window.lucide?.createIcons();
}

/** Un icono de Lucide para usar dentro de h``. */
export function icono(nombre) {
  return new HtmlSeguro(`<i data-lucide="${esc(nombre)}"></i>`);
}

/** Línea de estado bajo un formulario: verde si salió bien, roja si no. */
export function mostrarEstado(elemento, texto, ok) {
  if (!elemento) return;
  elemento.textContent = texto ?? '';
  elemento.className = 'estado' + (ok === true ? ' estado--ok' : ok === false ? ' estado--error' : '');
}

let temporizador = null;
export function notificar(texto, tipo = 'ok') {
  const caja = document.getElementById('notificacion');
  caja.textContent = texto;
  caja.className = `notificacion notificacion--${tipo}`;
  caja.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (caja.hidden = true), 3500);
}

export function datosFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario).entries());
}

export function fecha(valor) {
  return new Date(valor).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
}
