// Perfil de la persona con sesión iniciada: un solo caso de uso que reúne varios patrones.

import { estado, fecha, h, pintar } from './util.js';

const contenedor = document.getElementById('perfil-contenido');

function decodificar(parte) {
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(base64))));
}

function tarjetaToken() {
  const [cabecera, cuerpo, firma] = estado.token.split('.');
  return h`<article class="tarjeta tarjeta--ancha">
    <h3>🔏 Token firmado (JWT) <span class="patron">Singleton</span></h3>
    <p class="ayuda">La credencial viaja como JWT firmado con HMAC-SHA256 y el <code>JWT_SECRET</code> del Gestor de Configuración.
      Si alguien cambia un solo permiso en el texto, la firma deja de cuadrar y el servidor lo rechaza.</p>
    <div class="jwt"><span class="jwt__cabecera">${cabecera}</span>.<span class="jwt__cuerpo">${cuerpo}</span>.<span class="jwt__firma">${firma}</span></div>
    <div class="rejilla-dos">
      <div><div class="http__titulo">Cabecera</div><pre>${JSON.stringify(decodificar(cabecera), null, 2)}</pre></div>
      <div><div class="http__titulo">Contenido</div><pre>${JSON.stringify(decodificar(cuerpo), null, 2)}</pre></div>
    </div>
  </article>`;
}

/** Dibuja el árbol del rol con el catálogo: los grupos con sus permisos dentro, y los permisos sueltos. */
function arbolPermisos(componentes) {
  const catalogo = estado.config.catalogoDePermisos;
  const descripcionDe = (permiso) => Object.values(catalogo).find((g) => permiso in g.permisos)?.permisos[permiso] ?? '';
  const hoja = (permiso) => h`<li>🔹 ${permiso} <small>${descripcionDe(permiso)}</small></li>`;

  return h`<ul class="arbol">${componentes.map((c) =>
    catalogo[c]
      ? h`<li><span class="arbol__grupo">📁 ${c}</span> <small>${catalogo[c].descripcion}</small>
          <ul>${Object.keys(catalogo[c].permisos).map(hoja)}</ul></li>`
      : hoja(c),
  )}</ul>`;
}

function tarjetaAvisos() {
  if (!estado.avisos) return '';
  const { sms, correo } = estado.avisos;
  return h`<article class="tarjeta">
    <h3>🔔 Aviso de inicio de sesión <span class="patron">Bridge</span></h3>
    <p class="ayuda">El mismo aviso, con dos tipos de notificación (urgente y simple) por dos canales (SMS y correo).</p>
    <ul class="lista-simple">
      <li>📱 Urgente por SMS: <span class="chip ${sms.enviado ? 'chip--ok' : 'chip--error'}">${sms.proveedor} · ${sms.enviado ? 'enviado' : 'falló'}</span></li>
      <li>✉️ Simple por correo: ${correo
        ? h`<span class="chip ${correo.enviado ? 'chip--ok' : 'chip--error'}">${correo.proveedor} · ${correo.enviado ? 'enviado' : 'falló'}</span>`
        : h`<span class="chip">sin correo registrado</span>`}</li>
    </ul>
  </article>`;
}

export function pintarPerfil({ alIrAlPanel }) {
  const p = estado.perfil;
  const c = p.credencial;
  const identidad = p.identidad.error
    ? h`<p class="estado estado--error">${p.identidad.error}</p>`
    : h`<dl class="datos">
        <dt>Nombre</dt><dd>${p.identidad.nombreCompleto}</dd>
        <dt>Documento</dt><dd>${p.documento.nombreTipo} ${p.identidad.documento}
          <span class="chip ${p.documento.valido ? 'chip--ok' : 'chip--error'}">${p.documento.valido ? 'formato válido' : 'formato inválido'}</span></dd>
        <dt>Teléfono</dt><dd>${p.telefono}</dd>
      </dl>`;

  pintar(
    contenedor,
    h`
    <div class="columna">
    <article class="tarjeta credencial">
      <h3>🪪 Credencial digital <span class="patron">Builder</span></h3>
      <dl class="datos">
        <dt>Titular</dt><dd>${c.nombreCompleto}</dd>
        <dt>Identificador</dt><dd><code>${c.usuarioId}</code> <small>(seudónimo: no revela el documento)</small></dd>
        <dt>Rol</dt><dd><span class="chip chip--dorado">${c.rol}</span></dd>
        <dt>Factores</dt><dd>${c.factoresSuperados.map((f) => h`<span class="chip chip--ok">${f}</span> `)}</dd>
        <dt>Emitida</dt><dd>${fecha(c.emitidaEn)}</dd>
        <dt>Expira</dt><dd>${fecha(c.expiraEn)}</dd>
      </dl>
      ${p.panel.length > 0 ? h`<button class="boton" id="btn-ir-panel">⚙️ Ir al panel de administración</button>` : ''}
    </article>
    </div>

    <div class="columna">
    <article class="tarjeta">
      <h3>👤 Identidad verificada <span class="patron">Proxy</span><span class="patron">Flyweight</span></h3>
      <p class="ayuda">Se consulta a través del Proxy, que exige el permiso <code>consultar-identidad</code>. Los datos se descifran solo para ti.</p>
      ${identidad}
    </article>
    ${tarjetaAvisos()}
    </div>

    <article class="tarjeta">
      <h3>🗂️ Permisos de tu rol <span class="patron">Composite</span></h3>
      <p class="ayuda">${p.rol.descripcion}</p>
      ${arbolPermisos(p.rol.componentes)}
      <p class="ayuda">Permisos efectivos (<code>listar()</code>): ${p.rol.permisos.map((x) => h`<code>${x}</code> `)}</p>
    </article>

    ${tarjetaToken()}
  `,
  );

  document.getElementById('btn-ir-panel')?.addEventListener('click', alIrAlPanel);
}
