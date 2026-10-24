// Página principal: carga el estado del sistema, conecta las vistas y decide qué pestañas se ven.

import { api, dibujarIconos, estado, guardarSesion, h, mostrarEstado, notificar, pintar } from './util.js';
import { actualizarModoRegistro, iniciarRegistro } from './registro.js';
import { iniciarInicioSesion, prellenarDocumento, reiniciarInicioSesion } from './inicio-sesion.js';
import { pintarPerfil } from './perfil.js';
import { abrirAdmin, iniciarAdmin } from './admin.js';

function ir(vista) {
  document.querySelectorAll('[data-vista]').forEach((v) => (v.hidden = v.dataset.vista !== vista));
  document.querySelectorAll('[data-ir]').forEach((b) => b.classList.toggle('pestana--activa', b.dataset.ir === vista));
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
  document.querySelector('[data-ir="perfil"]').hidden = !conSesion;
  document.querySelector('[data-ir="admin"]').hidden = !conSesion || estado.perfil.panel.length === 0;
  document.querySelector('[data-ir="inicio"]').hidden = conSesion;
  if (conSesion) {
    document.getElementById('sesion-nombre').textContent = estado.perfil.credencial.nombreCompleto;
    document.getElementById('sesion-rol').textContent = estado.perfil.credencial.rol;
    pintarPerfil({ alIrAlPanel: () => ir('admin') });
  }
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
  notificar(`Bienvenido, ${estado.perfil.credencial.nombreCompleto}.`);
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

  document.querySelector('.pestanas').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ir]');
    if (boton) ir(boton.dataset.ir);
  });
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
