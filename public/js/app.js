// Página principal: carga el estado del sistema, conecta las vistas y decide qué pestañas se ven.

import { api, dibujarIconos, estado, guardarSesion, h, iniciales, mostrarEstado, notificar, pintar } from './util.js';
import { actualizarModoRegistro, iniciarRegistro } from './registro.js';
import { iniciarInicioSesion, prellenarDocumento, reiniciarInicioSesion } from './inicio-sesion.js';
import { pintarPerfil } from './perfil.js';
import { abrirAdmin, iniciarAdmin } from './admin.js';

function ir(vista) {
  // Con sesión iniciada no tiene sentido volver a la pantalla de entrada ni al registro.
  if (estado.perfil && (vista === 'inicio' || vista === 'registro')) vista = 'perfil';
  document.querySelectorAll('[data-vista]').forEach((v) => (v.hidden = v.dataset.vista !== vista));
  document.querySelectorAll('.nav-enlace').forEach((b) => b.classList.toggle('activo', b.dataset.ir === vista));
  if (vista === 'admin') abrirAdmin();
  window.scrollTo({ top: 0 });
}

async function cargarEstado() {
  const { datos } = await api('GET', '/api/estado', undefined, null);
  estado.config = datos;
  const opciones = h`${datos.tiposDocumento.map((t) => h`<option value="${t.codigo}">${t.codigo} · ${t.nombre}</option>`)}`;
  document.querySelectorAll('.tipos-documento').forEach((selector) => pintar(selector, opciones));
  document.getElementById('aviso-configuracion').hidden = datos.hayAdministrador;
  actualizarModoRegistro();
}

/** Con token: trae el perfil. Si el token ya no sirve (expiró o se revocó), se cierra la sesión local. */
async function cargarPerfil() {
  if (!estado.token) return false;
  const { ok, datos } = await api('GET', '/api/perfil');
  if (!ok) {
    guardarSesion(null);
    estado.perfil = null;
    return false;
  }
  estado.perfil = datos;
  return true;
}

function pintarCabecera() {
  const conSesion = Boolean(estado.perfil);
  document.getElementById('sesion-actual').hidden = !conSesion;
  document.getElementById('acciones-anonimas').hidden = conSesion;
  document.querySelector('.nav-enlace[data-ir="perfil"]').hidden = !conSesion;
  document.querySelector('.nav-enlace[data-ir="admin"]').hidden = !conSesion || estado.perfil.panel.length === 0;
  if (conSesion) {
    const { nombreCompleto, rol } = estado.perfil.credencial;
    document.getElementById('sesion-nombre').textContent = nombreCompleto;
    document.getElementById('sesion-rol').textContent = rol;
    document.getElementById('sesion-iniciales').textContent = iniciales(nombreCompleto);
    pintarPerfil();
  }
}

/** Interruptor del pie: muestra los patrones de diseño usados en cada parte (para presentar). */
function iniciarInterruptorPatrones() {
  const interruptor = document.getElementById('interruptor-patrones');
  try {
    interruptor.checked = localStorage.getItem('sgid.patrones') === 'si';
  } catch {
    // sin almacenamiento: arranca apagado
  }
  const aplicar = () => document.body.classList.toggle('con-patrones', interruptor.checked);
  interruptor.addEventListener('change', () => {
    aplicar();
    try {
      localStorage.setItem('sgid.patrones', interruptor.checked ? 'si' : 'no');
    } catch {
      // sin almacenamiento: dura hasta recargar
    }
  });
  aplicar();
}

// --- "Iniciar sesión con SGID": la persona llega desde un servicio del Estado ---

async function leerAutorizacion() {
  if (location.pathname !== '/autorizar') return;
  const parametros = new URLSearchParams(location.search);
  const pedido = {
    clientId: parametros.get('client_id') ?? '',
    redirectUri: parametros.get('redirect_uri') ?? '',
    state: parametros.get('state') ?? '',
  };
  const consulta = new URLSearchParams({ client_id: pedido.clientId, redirect_uri: pedido.redirectUri });
  const { ok, datos } = await api('GET', `/api/autorizacion?${consulta}`, undefined, null);
  if (!ok) return notificar(datos.error, 'error');

  estado.autorizacion = { ...pedido, servicio: datos.servicio };
  document.getElementById('aviso-servicio').textContent = datos.servicio;
  document.getElementById('autorizar-servicio').textContent = datos.servicio;
  document.getElementById('aviso-autorizacion').hidden = false;
}

async function permitir() {
  const a = estado.autorizacion;
  const { ok, datos } = await api('POST', '/api/autorizar', { client_id: a.clientId, redirect_uri: a.redirectUri, state: a.state });
  if (!ok) return mostrarEstado(document.querySelector('[data-vista="autorizar"] [data-estado]'), datos.error, false);
  location.href = datos.url; // de vuelta al servicio, con el código
}

function cancelarAutorizacion() {
  const url = new URL(estado.autorizacion.redirectUri);
  url.searchParams.set('error', 'access_denied');
  if (estado.autorizacion.state) url.searchParams.set('state', estado.autorizacion.state);
  location.href = url.toString();
}

// --- Sesión ---

async function alEntrar() {
  await cargarPerfil();
  await cargarEstado();
  pintarCabecera();
  if (estado.autorizacion) return ir('autorizar');
  notificar(`Bienvenido, ${estado.perfil.credencial.nombreCompleto.split(' ')[0]}.`);
  ir('perfil');
}

async function cerrarSesion() {
  await api('POST', '/api/sesion/cerrar');
  guardarSesion(null);
  estado.perfil = null;
  pintarCabecera();
  reiniciarInicioSesion();
  notificar('Sesión cerrada.');
  ir('inicio');
}

async function arrancar() {
  await cargarEstado();
  await cargarPerfil();
  await leerAutorizacion();
  pintarCabecera();

  // Cualquier botón con data-ir (barra, enlaces dentro de las vistas) cambia de vista.
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ir]');
    if (boton) ir(boton.dataset.ir);
  });
  iniciarInterruptorPatrones();
  document.getElementById('btn-cerrar-sesion').addEventListener('click', cerrarSesion);
  document.getElementById('btn-permitir').addEventListener('click', permitir);
  document.getElementById('btn-cancelar-autorizacion').addEventListener('click', cancelarAutorizacion);

  iniciarRegistro({
    alRegistrar: async (documento) => {
      await cargarEstado();
      if (estado.perfil) return; // un administrador con sesión registrando a alguien más
      prellenarDocumento(documento);
      ir('inicio');
    },
  });
  iniciarInicioSesion({ alEntrar });
  iniciarAdmin();
  dibujarIconos();

  if (estado.autorizacion) ir(estado.perfil ? 'autorizar' : 'inicio');
  else ir(estado.perfil ? 'perfil' : estado.config.hayAdministrador ? 'inicio' : 'registro');
}

arrancar();
