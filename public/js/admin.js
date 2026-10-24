// Panel de administración: roles y permisos (Composite), usuarios, entidades externas y auditoría.

import { api, datosFormulario, estado, fecha, h, mostrarEstado, notificar, pintar } from './util.js';

let roles = [];
let rolAbierto = null; // nombre del rol que está en el editor; null = rol nuevo
let alProbarEntidad = () => {};

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
        <strong>${rol.nombre}</strong> ${rol.base ? h`<span class="chip">base</span>` : ''}
        <small>${rol.permisos.length} permiso(s) · ${rol.enUso} en uso</small>
      </button></li>`,
    ),
  );
}

/** Casillas del catálogo: un grupo completo (nodo compuesto) o permisos sueltos (hojas). */
function casillasDelCatalogo(marcados) {
  return Object.entries(estado.config.catalogoDePermisos).map(
    ([grupo, { descripcion, permisos }]) => h`<fieldset class="grupo-permisos">
      <label class="grupo-permisos__grupo">
        <input type="checkbox" data-grupo="${grupo}" ${marcados.has(grupo) ? 'checked' : ''} />
        📁 <strong>${grupo}</strong> <small>grupo completo · ${descripcion}</small>
      </label>
      ${Object.entries(permisos).map(
        ([permiso, detalle]) => h`<label class="grupo-permisos__permiso">
          <input type="checkbox" data-permiso="${permiso}" data-padre="${grupo}" ${marcados.has(permiso) ? 'checked' : ''} />
          🔹 ${permiso} <small>${detalle}</small>
        </label>`,
      )}
    </fieldset>`,
  );
}

function pintarEditor() {
  const rol = roles.find((r) => r.nombre === rolAbierto);
  pintar(
    document.getElementById('editor-rol'),
    h`<h3>${rol ? h`Editar rol <code>${rol.nombre}</code>` : 'Nuevo rol'}</h3>
    <form id="form-rol" class="formulario">
      <div class="fila">
        <label>Nombre<input name="nombre" required value="${rol?.nombre ?? ''}" ${rol ? 'disabled' : ''} placeholder="ej.: auditor-externo" /></label>
        <label>Descripción<input name="descripcion" value="${rol?.descripcion ?? ''}" placeholder="Para qué sirve este rol" /></label>
      </div>
      <p class="ayuda">Si marcas un <strong>grupo completo</strong>, sus permisos quedan incluidos (también los que se le agreguen después).</p>
      <div class="catalogo">${casillasDelCatalogo(new Set(rol?.componentes ?? []))}</div>
      <div class="vista-previa" id="vista-previa-rol"></div>
      <div class="fila-botones">
        <button class="boton">${rol ? 'Guardar cambios' : 'Crear rol'}</button>
        ${rol && !rol.base ? h`<button type="button" class="boton boton--peligro" id="btn-eliminar-rol">Eliminar rol</button>` : ''}
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
  pintar(
    document.getElementById('vista-previa-rol'),
    h`<strong>Permisos efectivos (${efectivos.length}):</strong> ${efectivos.map((p) => h`<code>${p}</code> `)}`,
  );
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
        <td>${u.nombreCompleto} ${u.usuarioId === yo ? h`<span class="chip chip--dorado">tú</span>` : ''}</td>
        <td>${u.documento}</td>
        <td>${u.telefono}</td>
        <td><select data-cambiar-rol="${u.usuarioId}" data-actual="${u.rol}" ${u.usuarioId === yo ? 'disabled' : ''}>
          ${nombresRoles.map((r) => h`<option ${r === u.rol ? 'selected' : ''}>${r}</option>`)}
        </select></td>
        <td>${fecha(u.creadoEn)}</td>
        <td><button class="boton boton--secundario boton--chico" data-desbloquear="${u.usuarioId}">Desbloquear</button></td>
      </tr>`,
    )}</tbody>`,
  );
}

// ===================== Entidades externas =====================

async function cargarEntidades() {
  const { ok, datos: lista } = await api('GET', '/api/admin/entidades');
  if (!ok) return mostrarError(lista);
  const nombresRoles = puede('gestionar-roles') ? (await traerRoles()).map((r) => r.nombre) : ['entidad-externa'];
  pintar(document.getElementById('entidad-rol'), nombresRoles.map((r) => h`<option ${r === 'entidad-externa' ? 'selected' : ''}>${r}</option>`));

  pintar(
    document.getElementById('tabla-entidades'),
    lista.length === 0
      ? h`<tbody><tr><td class="vacio">Todavía no hay entidades registradas.</td></tr></tbody>`
      : h`<thead><tr><th>Entidad</th><th>client_id</th><th>Rol</th><th>Estado</th><th>Registrada</th><th></th></tr></thead>
      <tbody>${lista.map(
        (e) => h`<tr>
          <td>${e.nombre}</td>
          <td><code>${e.clienteId}</code></td>
          <td>${e.rol}</td>
          <td><span class="chip ${e.activa ? 'chip--ok' : 'chip--error'}">${e.activa ? 'activa' : 'revocada'}</span></td>
          <td>${fecha(e.creadaEn)}</td>
          <td>${e.activa ? h`<button class="boton boton--peligro boton--chico" data-revocar="${e.clienteId}">Revocar</button>` : ''}</td>
        </tr>`,
      )}</tbody>`,
  );
}

// ===================== Auditoría =====================

async function cargarAuditoria() {
  const { ok, datos } = await api('GET', '/api/admin/auditoria');
  if (!ok) return mostrarError(datos);

  const { integra, total, rotaEn } = datos.integridad;
  pintar(
    document.getElementById('integridad-auditoria'),
    integra
      ? h`<div class="banda banda--ok">✅ Cadena íntegra: ${total} registro(s) verificados, ninguno alterado.</div>`
      : h`<div class="banda banda--error">⛔ La cadena está rota en el registro #${rotaEn}: el archivo se modificó por fuera del sistema.</div>`,
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
        <td><span class="chip ${r.resultado === 'exito' ? 'chip--ok' : 'chip--error'}">${r.resultado}</span></td>
        <td>${r.detalle}</td>
        <td><code title="${r.hash}">${r.hash.slice(0, 10)}…</code></td>
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

const cargadores = { roles: cargarRoles, usuarios: cargarUsuarios, entidades: cargarEntidades, auditoria: cargarAuditoria };

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

export function iniciarAdmin({ probarEntidad }) {
  alProbarEntidad = probarEntidad;

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
    notificar(`Rol cambiado a "${datos.rol}". Los permisos que pierde se cortan ya; los nuevos llegan al volver a entrar.`);
  });

  tablaUsuarios.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-desbloquear]');
    if (!boton) return;
    const { ok, datos } = await api('POST', `/api/admin/usuarios/${boton.dataset.desbloquear}/desbloquear`);
    if (ok) notificar('Intentos reiniciados: ya puede volver a intentar.');
    else mostrarError(datos);
  });

  document.getElementById('form-entidad').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const formulario = evento.target;
    const salida = formulario.parentElement.querySelector('[data-estado]');
    const { ok, datos } = await api('POST', '/api/admin/entidades', datosFormulario(formulario));
    if (!ok) return mostrarEstado(salida, datos.error, false);

    formulario.reset();
    mostrarEstado(salida, '');
    pintar(
      document.getElementById('secreto-entidad'),
      h`<div class="secreto">
        <strong>Credenciales de ${datos.nombre}</strong>: cópialas ahora, el secreto no se vuelve a mostrar.
        <dl class="datos"><dt>client_id</dt><dd><code>${datos.clienteId}</code></dd><dt>client_secret</dt><dd><code>${datos.secreto}</code></dd></dl>
        <button class="boton boton--secundario" id="btn-probar-entidad">Probar en "API gubernamental" →</button>
      </div>`,
    );
    document.getElementById('btn-probar-entidad').addEventListener('click', () => alProbarEntidad(datos));
    cargarEntidades();
  });

  document.getElementById('tabla-entidades').addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-revocar]');
    if (!boton || !confirm('¿Revocar esta entidad? Sus tokens dejarán de funcionar de inmediato.')) return;
    const { ok, datos } = await api('DELETE', `/api/admin/entidades/${boton.dataset.revocar}`);
    if (!ok) return mostrarError(datos);
    notificar('Entidad revocada.');
    cargarEntidades();
  });

  document.getElementById('btn-refrescar-auditoria').addEventListener('click', cargarAuditoria);
  document.getElementById('btn-exportar-auditoria').addEventListener('click', exportarAuditoria);
}
