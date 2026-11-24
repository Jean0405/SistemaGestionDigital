// Inicio de sesión: la persona elige dos de sus tres métodos (rostro, contraseña o código SMS).
// Cada método superado pone un sello en el "pase de acceso"; con dos sellos, entra.

import { api, datosFormulario, estado, guardarSesion, h, mostrarEstado, NOMBRES_FACTOR, pintar, sello } from './util.js';
import { crearCamara } from './camara.js';

const paso1 = document.getElementById('inicio-paso-1');
const paso2 = document.getElementById('inicio-paso-2');
const formInicio = document.getElementById('form-inicio');
const eleccion = document.getElementById('elegir-metodo');
const paneles = [...document.querySelectorAll('[data-panel-metodo]')];
const panelDe = (metodo) => paneles.find((p) => p.dataset.panelMetodo === metodo);

const marcoRostro = document.getElementById('marco-camara-inicio');
const avisoCamara = marcoRostro.querySelector('.marco-camara__aviso');
const camara = crearCamara(marcoRostro.querySelector('video'));
const botonRostro = document.getElementById('btn-verificar-rostro');
const botonEnviarCodigo = document.getElementById('btn-enviar-codigo');
const formCodigo = document.getElementById('form-codigo');
const entrando = document.getElementById('entrando');
const estadoFinal = document.getElementById('estado-completar');
const GIROS = [-9, 7]; // cada sello cae un poco torcido, como uno real

let intento = null;
let superados = []; // [{ factor, cuando }]
let alEntrar = () => {};

const yaSuperado = (factor) => superados.some((s) => s.factor === factor);

export function prellenarDocumento({ tipoDocumento, numeroDocumento }) {
  formInicio.tipoDocumento.value = tipoDocumento;
  formInicio.numeroDocumento.value = numeroDocumento;
}

export function reiniciarInicioSesion() {
  intento = null;
  superados = [];
  camara.apagar();
  ocultarSms();
  paso1.hidden = false;
  paso2.hidden = true;
  entrando.hidden = true;
  paso2.querySelectorAll('form').forEach((f) => f.reset());
  paso2.querySelectorAll('[data-estado]').forEach((e) => mostrarEstado(e, ''));
  mostrarEstado(estadoFinal, '');
  ['bitacora-contrasena', 'envios-sms', 'medidor-rostro'].forEach((id) => pintar(document.getElementById(id), ''));
  formCodigo.hidden = true;
  botonEnviarCodigo.textContent = 'Enviar código';
  llenarPase('—', '—', '––––––');
  mostrarEleccion();
}

// --- El pase y sus sellos ---

function llenarPase(titular, documento, folio) {
  document.getElementById('pase-titular').textContent = titular;
  document.getElementById('pase-documento').textContent = documento;
  document.getElementById('pase-folio').textContent = `N.º ${folio}`;
}

function pintarSellos() {
  document.querySelectorAll('[data-ranura]').forEach((ranura, i) => {
    const s = superados[i];
    if (s && ranura.dataset.factor === s.factor) return; // ya estaba estampado: no repetir la animación
    ranura.dataset.factor = s?.factor ?? '';
    pintar(ranura, s ? sello(s.factor, s.cuando, GIROS[i]) : h`<span class="ranura__vacia">sello ${i + 1}</span>`);
  });
  const faltan = (estado.config?.factoresMinimos ?? 2) - superados.length;
  document.getElementById('pase-nota').textContent =
    faltan <= 0 ? 'Dos sellos. Abriendo tu cuenta…' : faltan === 1 ? 'Falta un sello. Elige otro método.' : 'Cada método que verifiques pone un sello. Con dos, entras.';
}

// --- Elegir método ---

function mostrarEleccion() {
  camara.apagar();
  paneles.forEach((p) => (p.hidden = true));
  eleccion.hidden = false;
  document.getElementById('texto-elegir').textContent =
    superados.length === 0
      ? 'Elige con qué quieres confirmar tu identidad.'
      : `Primer sello: ${NOMBRES_FACTOR[superados[0].factor].toLowerCase()}. Elige otro método para el segundo.`;
  document.querySelectorAll('[data-metodo]').forEach((boton) => {
    const hecho = yaSuperado(boton.dataset.metodo);
    boton.classList.toggle('metodo--hecho', hecho);
    boton.disabled = hecho;
  });
  pintarSellos();
}

function abrirMetodo(metodo) {
  eleccion.hidden = true;
  paneles.forEach((p) => (p.hidden = p.dataset.panelMetodo !== metodo));
  mostrarEstado(panelDe(metodo).querySelector('[data-estado]'), '');
  mostrarEstado(estadoFinal, '');
  if (metodo === 'contraseña') document.querySelector('#form-contrasena input').focus();
  if (metodo === 'rostro') activarCamara();
}

/** Revisa la respuesta de un factor: si pasó, pone el sello y avanza; si no, muestra el motivo. */
function procesar(factor, respuesta) {
  const salida = panelDe(factor).querySelector('[data-estado]');
  if (!respuesta.ok) return mostrarEstado(salida, respuesta.datos.error, false);
  const { autenticado, motivo } = respuesta.datos;
  if (!autenticado) {
    const ayuda = respuesta.datos.factor === 'bloqueado' ? ' Puedes elegir otro método o pedir ayuda al administrador.' : '';
    return mostrarEstado(salida, motivo + ayuda, false);
  }

  if (!yaSuperado(factor)) superados.push({ factor, cuando: Date.now() });
  if (superados.length >= (estado.config.factoresMinimos ?? 2)) return completar();
  mostrarEleccion();
}

// --- Entrar ---

async function completar() {
  camara.apagar();
  ocultarSms();
  eleccion.hidden = true;
  paneles.forEach((p) => (p.hidden = true));
  pintarSellos();
  entrando.hidden = false;

  const [{ ok, datos }] = await Promise.all([
    api('POST', `/api/sesion/${intento.intentoId}/completar`),
    new Promise((r) => setTimeout(r, 900)), // deja ver el segundo sello antes de cambiar de pantalla
  ]);
  entrando.hidden = true;
  if (!ok) {
    mostrarEleccion();
    return mostrarEstado(estadoFinal, datos.error, false);
  }

  guardarSesion(datos.token, datos.avisos);
  formInicio.reset();
  reiniciarInicioSesion();
  alEntrar();
}

// --- Código SMS (simulado fuera de producción) ---

async function mostrarSmsSimulado() {
  if (!estado.config.smsSimulado) return;
  const { ok, datos } = await api('GET', `/api/sesion/${intento.intentoId}/sms/bandeja`);
  if (!ok || datos.mensajes.length === 0) return;
  document.getElementById('sms-texto').textContent = datos.mensajes[0].texto;
  document.getElementById('sms-entrante').hidden = false;
}

function ocultarSms() {
  document.getElementById('sms-entrante').hidden = true;
}

// --- Rostro ---

async function activarCamara() {
  const salida = panelDe('rostro').querySelector('[data-estado]');
  botonRostro.disabled = true;
  marcoRostro.classList.remove('listo');
  avisoCamara.textContent = 'Encendiendo la cámara…';
  try {
    await camara.activar();
    if (panelDe('rostro').hidden) return camara.apagar(); // la persona ya eligió otro método
    avisoCamara.textContent = '';
    marcoRostro.classList.add('listo');
    botonRostro.disabled = false;
  } catch (error) {
    avisoCamara.textContent = 'Cámara no disponible';
    mostrarEstado(salida, `No pudimos usar la cámara (${error.message}). Elige otro método.`, false);
  }
}

async function verificarRostro() {
  const salida = panelDe('rostro').querySelector('[data-estado]');
  botonRostro.disabled = true;
  mostrarEstado(salida, 'Mirando tu rostro…');
  let descriptor;
  try {
    descriptor = await camara.capturar();
  } catch (error) {
    botonRostro.disabled = false;
    return mostrarEstado(salida, error.message, false);
  }

  const respuesta = await api('POST', `/api/sesion/${intento.intentoId}/rostro`, { descriptor });
  botonRostro.disabled = false;
  if (respuesta.datos.puntaje !== undefined) {
    const { puntaje } = respuesta.datos;
    const umbral = estado.config.umbralFacial;
    pintar(
      document.getElementById('medidor-rostro'),
      h`<div class="medidor">
        <div class="medidor__barra"><div class="medidor__valor ${puntaje >= umbral ? 'medidor__valor--ok' : ''}" style="width:${Math.round(puntaje * 100)}%"></div>
          <div class="medidor__umbral" style="left:${Math.round(umbral * 100)}%" title="umbral"></div></div>
        <small>Parecido ${puntaje.toFixed(2)} · mínimo ${umbral}</small>
      </div>`,
    );
  }
  procesar('rostro', respuesta);
}

export function iniciarInicioSesion(opciones) {
  alEntrar = opciones.alEntrar;

  formInicio.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const salida = formInicio.querySelector('[data-estado]');
    const documento = datosFormulario(formInicio);
    const { ok, datos } = await api('POST', '/api/sesion/iniciar', documento);
    if (!ok) return mostrarEstado(salida, datos.error, false);

    mostrarEstado(salida, '');
    reiniciarInicioSesion();
    intento = datos;
    document.getElementById('inicio-saludo').textContent = `Hola, ${datos.nombre.split(' ')[0]}.`;
    document.getElementById('telefono-numero').textContent = datos.telefono;
    document.getElementById('metodo-sms-detalle').textContent = `Llega al ${datos.telefono}`;
    llenarPase(datos.nombre, `${documento.tipoDocumento} ${documento.numeroDocumento}`, datos.intentoId.slice(0, 6).toUpperCase());
    paso1.hidden = true;
    paso2.hidden = false;
  });

  document.getElementById('btn-otra-persona').addEventListener('click', reiniciarInicioSesion);
  document.querySelectorAll('[data-metodo]').forEach((b) => b.addEventListener('click', () => abrirMetodo(b.dataset.metodo)));
  document.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', mostrarEleccion));
  document.getElementById('btn-cerrar-sms').addEventListener('click', ocultarSms);

  // --- Contraseña ---
  document.getElementById('form-contrasena').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const respuesta = await api('POST', `/api/sesion/${intento.intentoId}/contrasena`, { valor: evento.target.valor.value });
    pintar(
      document.getElementById('bitacora-contrasena'),
      (respuesta.datos.bitacora ?? []).map((linea) => h`<li>${linea}</li>`),
    );
    evento.target.reset();
    procesar('contraseña', respuesta);
  });

  // --- Código SMS ---
  botonEnviarCodigo.addEventListener('click', async () => {
    const salida = panelDe('token-telefono').querySelector('[data-estado]');
    botonEnviarCodigo.disabled = true;
    const { ok, datos } = await api('POST', `/api/sesion/${intento.intentoId}/sms`);
    botonEnviarCodigo.disabled = false;
    if (!ok) return mostrarEstado(salida, datos.error, false);

    pintar(
      document.getElementById('envios-sms'),
      datos.envios.map((e) => h`<span class="etiqueta ${e.enviado ? 'etiqueta--ok' : 'etiqueta--error'}">${e.proveedor}: ${e.enviado ? 'enviado' : 'falló'}</span>`),
    );
    mostrarEstado(salida, `Código enviado al ${datos.telefono}.`, true);
    botonEnviarCodigo.textContent = 'Enviar otro código';
    formCodigo.hidden = false;
    formCodigo.valor.focus();
    await mostrarSmsSimulado();
  });

  formCodigo.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const respuesta = await api('POST', `/api/sesion/${intento.intentoId}/codigo`, { valor: formCodigo.valor.value });
    formCodigo.reset();
    if (respuesta.datos.autenticado) ocultarSms();
    procesar('token-telefono', respuesta);
  });

  // --- Rostro ---
  botonRostro.addEventListener('click', verificarRostro);
}
