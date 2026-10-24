// Página principal: carga el estado del sistema, conecta las vistas y decide qué pestañas se ven.
// La lógica de los patrones vive en el servidor; aquí solo se piden datos y se pintan resultados.

import { api, estado, guardarSesion, h, notificar, pintar } from './util.js';
import { actualizarModoRegistro, iniciarRegistro } from './registro.js';
import { iniciarInicioSesion, prellenarDocumento, reiniciarInicioSesion } from './inicio-sesion.js';
import { pintarPerfil } from './perfil.js';
import { abrirAdmin, iniciarAdmin } from './admin.js';
import { iniciarGobierno, prellenarEntidad } from './gobierno.js';

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
  document.querySelectorAll('.umbral-facial').forEach((e) => (e.textContent = datos.umbralFacial));
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

async function alEntrar() {
  await cargarPerfil();
  await cargarEstado();
  pintarCabecera();
  notificar(`Bienvenido, ${estado.perfil.credencial.nombreCompleto}.`);
  ir('perfil');
}

async function cerrarSesion() {
  await api('POST', '/api/sesion/cerrar');
  guardarSesion(null);
  estado.perfil = null;
  pintarCabecera();
  reiniciarInicioSesion();
  notificar('Sesión cerrada: el token quedó revocado.');
  ir('inicio');
}

async function arrancar() {
  await cargarEstado();
  await cargarPerfil();
  pintarCabecera();

  document.querySelector('.pestanas').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ir]');
    if (boton) ir(boton.dataset.ir);
  });
  document.getElementById('btn-cerrar-sesion').addEventListener('click', cerrarSesion);

  iniciarRegistro({
    alRegistrar: async (documento) => {
      await cargarEstado();
      if (estado.perfil) return; // un administrador con sesión registrando a alguien más
      prellenarDocumento(documento);
      ir('inicio');
    },
  });
  iniciarInicioSesion({ alEntrar });
  iniciarAdmin({
    probarEntidad: (credenciales) => {
      prellenarEntidad(credenciales);
      ir('gobierno');
    },
  });
  iniciarGobierno();

  ir(estado.perfil ? 'perfil' : estado.config.hayAdministrador ? 'inicio' : 'registro');
}

arrancar();
