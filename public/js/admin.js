// Panel de administración: roles y permisos, usuarios, servicios conectados y auditoría.

import { api, datosFormulario, estado, fecha, h, icono, mostrarEstado, notificar, pintar } from './util.js';

let roles = [];
let rolAbierto = null; // nombre del rol que está en el editor; null = rol nuevo

const puede = (permiso) => estado.perfil?.panel.includes(permiso);
const mostrarError = (datos) => notificar(datos.error ?? 'Algo salió mal.', 'error');

async function traerRoles() {
  const { ok, datos } = await api('GET', '/api/admin/roles');
  return ok ? datos : [];
}

// ===================== Roles y permisos =====================

async function cargarRoles() {
  roles = await traerRoles();
  pintarListaRoles();
  pintarEditor();
}

function pintarListaRoles() {
  pintar(
    document.getElementById('lista-roles'),
    roles.map(
      (rol) => h`<li><button class="item-rol ${rol.nombre === rolAbierto ? 'item-rol--activo' : ''}" data-rol="${rol.nombre}">
        <strong>${rol.nombre}</strong> ${rol.base ? h`<span class="etiqueta">base</span>` : ''}
        <small>${rol.permisos.length} permisos · ${rol.enUso} usuarios</small>
      </button></li>`,
    ),
  );
}

/** Casillas del catálogo: un grupo completo o permisos sueltos. */
function casillasDelCatalogo(marcados) {
  return Object.entries(estado.config.catalogoDePermisos).map(
    ([grupo, { descripcion, permisos }]) => h`<fieldset class="grupo-permisos">
      <label class="grupo-permisos__grupo" title="${descripcion}">
        <input type="checkbox" data-grupo="${grupo}" ${marcados.has(grupo) ? 'checked' : ''} />
        ${grupo} <span class="etiqueta">grupo completo</span>
      </label>
      ${Object.entries(permisos).map(
        ([permiso, detalle]) => h`<label title="${detalle}">
          <input type="checkbox" data-permiso="${permiso}" data-padre="${grupo}" ${marcados.has(permiso) ? 'checked' : ''} />
          ${permiso}
        </label>`,
      )}
    </fieldset>`,
  );
}

function pintarEditor() {
  const rol = roles.find((r) => r.nombre === rolAbierto);
  pintar(
    document.getElementById('editor-rol'),
    h`<h3>${rol ? h`Editar <code>${rol.nombre}</code>` : 'Nuevo rol'}</h3>
    <form id="form-rol" class="formulario">
      <div class="fila">
        <label>Nombre<input name="nombre" required value="${rol?.nombre ?? ''}" ${rol ? 'disabled' : ''} placeholder="ej.: auditor" /></label>
        <label>Descripción<input name="descripcion" value="${rol?.descripcion ?? ''}" /></label>
      </div>
      <div class="catalogo">${casillasDelCatalogo(new Set(rol?.componentes ?? []))}</div>
      <div class="vista-previa" id="vista-previa-rol"></div>
      <div class="fila-botones">
        <button class="boton">${rol ? 'Guardar' : 'Crear rol'}</button>
        ${rol && !rol.base ? h`<button type="button" class="boton boton--peligro" id="btn-eliminar-rol">${icono('trash-2')}Eliminar</button>` : ''}
      </div>
      <div class="estado" data-estado></div>
    </form>`,
  );

  const formulario = document.getElementById('form-rol');
  formulario.addEventListener('change', () => actualizarCasillas(formulario));
  formulario.addEventListener('submit', (evento) => guardarRol(evento, formulario, rol));
  document.getElementById('btn-eliminar-rol')?.addEventListener('click', () => eliminarRol(rol));
  actualizarCasillas(formulario);
}

/** Si el grupo está marcado, sus permisos se ven marcados y bloqueados (ya vienen con el grupo). */
function actualizarCasillas(formulario) {
  formulario.querySelectorAll('[data-grupo]').forEach((grupo) => {
    formulario.querySelectorAll(`[data-padre="${grupo.dataset.grupo}"]`).forEach((permiso) => {
      permiso.disabled = grupo.checked;
      if (grupo.checked) permiso.checked = true;
    });
  });
  const efectivos = [...formulario.querySelectorAll('[data-permiso]:checked')].map((c) => c.dataset.permiso);
  pintar(document.getElementById('vista-previa-rol'), h`Permisos (${efectivos.length}): ${efectivos.map((p) => h`<code>${p}</code> `)}`);
}

async function guardarRol(evento, formulario, rol) {
  evento.preventDefault();
  const { nombre, descripcion } = datosFormulario(formulario);
  const grupos = [...formulario.querySelectorAll('[data-grupo]:checked')].map((c) => c.dataset.grupo);
  const sueltos = [...formulario.querySelectorAll('[data-permiso]:checked:not(:disabled)')].map((c) => c.dataset.permiso);
  const cuerpo = { descripcion, componentes: [...grupos, ...sueltos] };

  const { ok, datos } = rol
    ? await api('PUT', `/api/admin/roles/${rol.nombre}`, cuerpo)
    : await api('POST', '/api/admin/roles', { nombre, ...cuerpo });
  if (!ok) return mostrarEstado(formulario.querySelector('[data-estado]'), datos.error, false);

  rolAbierto = datos.nombre;
  notificar(`Rol "${datos.nombre}" guardado.`);
  cargarRoles();
}

async function eliminarRol(rol) {
  if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return;
  const { ok, datos } = await api('DELETE', `/api/admin/roles/${rol.nombre}`);
  if (!ok) return mostrarError(datos);
  rolAbierto = null;
  notificar(`Rol "${rol.nombre}" eliminado.`);
  cargarRoles();
}

// ===================== Usuarios =====================

async function cargarUsuarios() {
  const { ok, datos: lista } = await api('GET', '/api/admin/usuarios');
  if (!ok) return mostrarError(lista);
  const nombresRoles = puede('gestionar-roles') ? (await traerRoles()).map((r) => r.nombre) : [...new Set(lista.map((u) => u.rol))];
  const yo = estado.perfil.credencial.usuarioId;

  pintar(
    document.getElementById('tabla-usuarios'),
    h`<thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Rol</th><th>Registrado</th><th></th></tr></thead>
    <tbody>${lista.map(
      (u) => h`<tr>
        <td>${u.nombreCompleto} ${u.usuarioId === yo ? h`<span class="etiqueta">tú</span>` : ''}</td>
        <td>${u.documento}</td>
        <td>${u.telefono}</td>
        <td><select data-cambiar-rol="${u.usuarioId}" data-actual="${u.rol}" ${u.usuarioId === yo ? 'disabled' : ''}>
          ${nombresRoles.map((r) => h`<option ${r === u.rol ? 'selected' : ''}>${r}</option>`)}
        </select></td>
        <td>${fecha(u.creadoEn)}</td>
        <td><button class="boton boton--linea boton--chico" data-desbloquear="${u.usuarioId}">${icono('unlock')}Desbloquear</button></td>
      </tr>`,
    )}</tbody>`,
  );
}

// ===================== Servicios conectados =====================

async function cargarServicios() {
  const { ok, datos: lista } = await api('GET', '/api/admin/servicios');
  if (!ok) return mostrarError(lista);

  pintar(
    document.getElementById('tabla-servicios'),
    lista.length === 0
      ? h`<tbody><tr><td class="vacio">Todavía no hay servicios conectados.</td></tr></tbody>`
      : h`<thead><tr><th>Servicio</th><th>client_id</th><th>URL de retorno</th><th>Estado</th><th>Conectado</th><th></th></tr></thead>
      <tbody>${lista.map(
        (s) => h`<tr>
          <td>${s.nombre}</td>
          <td><code>${s.clienteId}</code></td>
          <td><code>${s.urlRetorno}</code></td>
          <td><span class="etiqueta ${s.activo ? 'etiqueta--ok' : 'etiqueta--error'}">${s.activo ? 'activo' : 'desconectado'}</span></td>
          <td>${fecha(s.creadoEn)}</td>
          <td>${s.activo ? h`<button class="boton boton--peligro boton--chico" data-desconectar="${s.clienteId}">Desconectar</button>` : ''}</td>
        </tr>`,
      )}</tbody>`,
  );
}

/** Deja las credenciales a mano para el servicio de prueba y lo abre en otra pestaña. */
function abrirServicioDePrueba(credenciales) {
  try {
    localStorage.setItem('sgid.servicioDePrueba', JSON.stringify(credenciales));
  } catch {
    // sin almacenamiento: se escriben a mano en la página del servicio
  }
  window.open('/servicio-demo.html', '_blank');
}

// ===================== Auditoría =====================

async function cargarAuditoria() {
  const { ok, datos } = await api('GET', '/api/admin/auditoria');
  if (!ok) return mostrarError(datos);

  const { integra, total, rotaEn } = datos.integridad;
  pintar(
    document.getElementById('integridad-auditoria'),
    integra
      ? h`<div class="integridad integridad--ok">${icono('check-circle')}Cadena íntegra · ${total} registros</div>`
      : h`<div class="integridad integridad--error">${icono('x-circle')}Cadena rota en el registro #${rotaEn}</div>`,
  );
  pintar(
    document.getElementById('tabla-auditoria'),
    h`<thead><tr><th>#</th><th>Fecha</th><th>Actor</th><th>Acción</th><th>Resultado</th><th>Detalle</th><th>Hash</th></tr></thead>
    <tbody>${datos.registros.map(
      (r) => h`<tr>
        <td>${r.numero}</td>
        <td>${fecha(r.fecha)}</td>
        <td>${r.actor}</td>
        <td><code>${r.accion}</code></td>
        <td><span class="etiqueta ${r.resultado === 'exito' ? 'etiqueta--ok' : 'etiqueta--error'}">${r.resultado}</span></td>
        <td>${r.detalle}</td>
        <td><code title="${r.hash}">${r.hash.slice(0, 10)}</code></td>
      </tr>`,
    )}</tbody>`,
  );
}

async function exportarAuditoria() {
  const { ok, datos } = await api('GET', '/api/admin/auditoria/exportar');
  if (!ok) return mostrarError(datos);
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  enlace.download = `auditoria-sgid-${new Date().toISOString().slice(0, 10)}.json`;
  enlace.click();
  cargarAuditoria();
}

// ===================== Navegación del panel =====================

const cargadores = { roles: cargarRoles, usuarios: cargarUsuarios, servicios: cargarServicios, auditoria: cargarAuditoria };

function abrirSubpestana(nombre) {
  document.querySelectorAll('[data-admin]').forEach((b) => b.classList.toggle('subpestana--activa', b.dataset.admin === nombre));
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== nombre));
  cargadores[nombre]();
}

/** Muestra solo las secciones para las que la persona tiene permiso. */
export function abrirAdmin() {
  const botones = [...document.querySelectorAll('[data-admin]')];
  botones.forEach((b) => (b.hidden = !puede(b.dataset.permiso)));
  document.getElementById('btn-exportar-auditoria').hidden = !puede('exportar-auditoria');
  const visibles = botones.filter((b) => !b.hidden);
  const activa = visibles.find((b) => b.classList.contains('subpestana--activa')) ?? visibles[0];
  if (activa) abrirSubpestana(activa.dataset.admin);
}

export function iniciarAdmin() {
  document.getElementById('servicio-url').value = `${location.origin}/servicio-demo.html`;

  document.getElementById('admin-pestanas').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-admin]');
    if (boton) abrirSubpestana(boton.dataset.admin);
  });

  document.getElementById('lista-roles').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-rol]');
    if (!boton) return;
    rolAbierto = boton.dataset.rol;
    pintarListaRoles();
    pintarEditor();
  });

  document.getElementById('btn-nuevo-rol').addEventListener('click', () => {
    rolAbierto = null;
    pintarListaRoles();
    pintarEditor();
  });

  const tablaUsuarios = document.getElementById('tabla-usuarios');
  tablaUsuarios.addEventListener('change', async (evento) => {
    const selector = evento.target.closest('[data-cambiar-rol]');
    if (!selector) return;
    const { ok, datos } = await api('PUT', `/api/admin/usuarios/${selector.dataset.cambiarRol}/rol`, { rol: selector.value });
    if (!ok) {
      selector.value = selector.dataset.actual;
      return mostrarError(datos);
    }
    selector.dataset.actual = datos.rol;
    notificar(`Rol cambiado a "${datos.rol}".`);
  });

  tablaUsuarios.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-desbloquear]');
    if (!boton) return;
    const { ok, datos } = await api('POST', `/api/admin/usuarios/${boton.dataset.desbloquear}/desbloquear`);
    if (ok) notificar('Intentos reiniciados.');
    else mostrarError(datos);
  });

  document.getElementById('form-servicio').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const formulario = evento.target;
    const salida = formulario.parentElement.querySelector('[data-estado]');
    const { ok, datos } = await api('POST', '/api/admin/servicios', datosFormulario(formulario));
    if (!ok) return mostrarEstado(salida, datos.error, false);

    formulario.nombre.value = '';
    mostrarEstado(salida, '');
    pintar(
      document.getElementById('credenciales-servicio'),
      h`<div class="credenciales">
        <strong>${datos.nombre}</strong>
        <dl class="datos"><dt>client_id</dt><dd><code>${datos.clienteId}</code></dd><dt>client_secret</dt><dd><code>${datos.secreto}</code></dd></dl>
        <small>El secreto no se vuelve a mostrar.</small>
        <button class="boton boton--linea" id="btn-servicio-prueba">${icono('external-link')}Abrir servicio de prueba</button>
      </div>`,
    );
    document.getElementById('btn-servicio-prueba').addEventListener('click', () => abrirServicioDePrueba(datos));
    cargarServicios();
  });

  document.getElementById('tabla-servicios').addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-desconectar]');
    if (!boton || !confirm('¿Desconectar este servicio? Ya no podrá iniciar sesión con SGID.')) return;
    const { ok, datos } = await api('DELETE', `/api/admin/servicios/${boton.dataset.desconectar}`);
    if (!ok) return mostrarError(datos);
    notificar('Servicio desconectado.');
    cargarServicios();
  });

  document.getElementById('btn-refrescar-auditoria').addEventListener('click', cargarAuditoria);
  document.getElementById('btn-exportar-auditoria').addEventListener('click', exportarAuditoria);
}
