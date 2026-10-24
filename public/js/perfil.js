// Perfil de la persona con sesión iniciada.

import { estado, fecha, h, icono, pintar } from './util.js';

const contenedor = document.getElementById('perfil-contenido');

function decodificar(parte) {
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(base64))));
}

/** Árbol del rol: los grupos con sus permisos dentro, y los permisos sueltos. */
function arbolPermisos(componentes) {
  const catalogo = estado.config.catalogoDePermisos;
  const hoja = (permiso) => h`<li><span class="nodo">${icono('key-round')}${permiso}</span></li>`;
  return h`<ul class="arbol">${componentes.map((c) =>
    catalogo[c]
      ? h`<li><span class="nodo">${icono('folder')}<strong>${c}</strong></span><ul>${Object.keys(catalogo[c].permisos).map(hoja)}</ul></li>`
      : hoja(c),
  )}</ul>`;
}

function avisos() {
  if (!estado.avisos) return '';
  const fila = (nombre, envio) =>
    envio
      ? h`<dt>${nombre}</dt><dd><span class="etiqueta ${envio.enviado ? 'etiqueta--ok' : 'etiqueta--error'}">${envio.enviado ? 'enviado' : 'falló'}</span> ${envio.proveedor}</dd>`
      : h`<dt>${nombre}</dt><dd><span class="etiqueta">sin correo</span></dd>`;
  return h`<article class="tarjeta">
    <h3>${icono('bell')}Aviso de inicio de sesión</h3>
    <div class="burbujas"><span class="patron">Bridge</span></div>
    <dl class="datos">${fila('SMS', estado.avisos.sms)}${fila('Correo', estado.avisos.correo)}</dl>
  </article>`;
}

export function pintarPerfil({ alIrAlPanel }) {
  const p = estado.perfil;
  const c = p.credencial;
  const [cabecera, cuerpo, firma] = estado.token.split('.');

  pintar(
    contenedor,
    h`
    <article class="tarjeta">
      <h3>${icono('badge-check')}Credencial digital</h3>
      <div class="burbujas"><span class="patron">Builder</span></div>
      <dl class="datos">
        <dt>Titular</dt><dd>${c.nombreCompleto}</dd>
        <dt>Rol</dt><dd><span class="etiqueta">${c.rol}</span></dd>
        <dt>Factores</dt><dd>${c.factoresSuperados.map((f) => h`<span class="etiqueta etiqueta--ok">${f}</span> `)}</dd>
        <dt>Expira</dt><dd>${fecha(c.expiraEn)}</dd>
      </dl>
      ${p.panel.length > 0 ? h`<button class="boton boton--linea" id="btn-ir-panel">${icono('settings')}Ir a administración</button>` : ''}
    </article>

    <article class="tarjeta">
      <h3>${icono('contact')}Identidad</h3>
      <div class="burbujas"><span class="patron">Proxy</span><span class="patron">Flyweight</span></div>
      ${p.identidad.error
        ? h`<p class="estado estado--error">${p.identidad.error}</p>`
        : h`<dl class="datos">
            <dt>Nombre</dt><dd>${p.identidad.nombreCompleto}</dd>
            <dt>Documento</dt><dd>${p.documento.nombreTipo} ${p.identidad.documento}
              <span class="etiqueta ${p.documento.valido ? 'etiqueta--ok' : 'etiqueta--error'}">${p.documento.valido ? 'válido' : 'inválido'}</span></dd>
            <dt>Teléfono</dt><dd>${p.telefono}</dd>
          </dl>`}
    </article>

    <article class="tarjeta">
      <h3>${icono('shield')}Permisos de tu rol</h3>
      <div class="burbujas"><span class="patron">Composite</span></div>
      ${arbolPermisos(p.rol.componentes ?? [])}
    </article>

    ${avisos()}

    <article class="tarjeta ancho-completo">
      <h3>${icono('lock')}Token de sesión</h3>
      <div class="burbujas"><span class="patron">Singleton</span></div>
      <div class="jwt"><span class="jwt__cabecera">${cabecera}</span>.<span class="jwt__cuerpo">${cuerpo}</span>.<span class="jwt__firma">${firma}</span></div>
      <pre>${JSON.stringify(decodificar(cuerpo), null, 2)}</pre>
    </article>
  `,
  );

  document.getElementById('btn-ir-panel')?.addEventListener('click', alIrAlPanel);
}
