// "Mi identidad": el carné digital y los datos de la persona con sesión iniciada.

import { estado, h, iniciales, pintar, sello } from './util.js';

const contenedor = document.getElementById('perfil-contenido');

function decodificar(parte) {
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(base64))));
}

const hora = (valor) => new Date(valor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Los permisos del rol en palabras: cada grupo con sus permisos, y los permisos sueltos (Composite). */
function listaPermisos(componentes) {
  const catalogo = estado.config.catalogoDePermisos;
  const descripcionDe = (permiso) => Object.values(catalogo).find((g) => permiso in g.permisos)?.permisos[permiso] ?? permiso;
  const item = (permiso) => h`<li><span>${descripcionDe(permiso)}</span><code class="solo-patrones">${permiso}</code></li>`;

  const grupos = componentes.filter((c) => catalogo[c]);
  const sueltos = componentes.filter((c) => !catalogo[c]);
  return h`<ul class="lista-permisos">
    ${sueltos.map(item)}
    ${grupos.map((g) => h`<li class="lista-permisos__grupo">${catalogo[g].descripcion}</li>${Object.keys(catalogo[g].permisos).map(item)}`)}
  </ul>`;
}

function avisoInicio() {
  if (!estado.avisos) return '';
  const canal = (nombre, envio) =>
    envio
      ? h`<dt>${nombre}</dt><dd><span class="etiqueta ${envio.enviado ? 'etiqueta--ok' : 'etiqueta--error'}">${envio.enviado ? 'enviado' : 'falló'}</span><small class="solo-patrones">${envio.proveedor}</small></dd>`
      : h`<dt>${nombre}</dt><dd><span class="etiqueta">sin correo</span></dd>`;
  return h`<section class="bloque">
    <h2>Aviso de este ingreso</h2>
    <p class="ayuda">Cada vez que entras te avisamos, por si no fuiste tú.</p>
    <dl class="datos">${canal('SMS', estado.avisos.sms)}${canal('Correo', estado.avisos.correo)}</dl>
    <div class="burbujas solo-patrones"><span class="patron">Bridge</span></div>
  </section>`;
}

export function pintarPerfil() {
  const p = estado.perfil;
  const c = p.credencial;
  const [cabecera, cuerpo, firma] = estado.token.split('.');

  pintar(
    contenedor,
    h`<div class="perfil">
      <div class="encabezado-vista">
        <p class="rotulo">Mi identidad</p>
        <h1>Hola, ${c.nombreCompleto.split(' ')[0]}.</h1>
      </div>

      <div class="perfil__rejilla">
        <div class="perfil__columna">
          <section class="carne" aria-label="Carné digital">
            <div class="carne__banda"><span>SGID</span><span>Carné digital</span></div>
            <div class="carne__cuerpo">
              <div class="carne__foto" aria-hidden="true">${iniciales(c.nombreCompleto)}</div>
              ${p.identidad.error
                ? h`<p class="estado estado--error">${p.identidad.error}</p>`
                : h`<dl class="carne__datos">
                    <div class="completo"><dt>Nombre</dt><dd class="carne__nombre">${p.identidad.nombreCompleto}</dd></div>
                    <div><dt>${p.documento.nombreTipo}</dt><dd class="dato">${p.identidad.documento}
                      <span class="etiqueta ${p.documento.valido ? 'etiqueta--ok' : 'etiqueta--error'}">${p.documento.valido ? 'válido' : 'inválido'}</span></dd></div>
                    <div><dt>Celular</dt><dd class="dato">${p.telefono}</dd></div>
                    <div><dt>Rol</dt><dd>${conMayuscula(c.rol)}</dd></div>
                    <div><dt>Vigente hasta</dt><dd class="dato">${hora(c.expiraEn)}</dd></div>
                  </dl>`}
            </div>
            <div class="carne__pie">
              <p>Entraste con estos dos sellos. La sesión se cierra sola al vencer.</p>
              <div class="carne__sellos">${c.factoresSuperados.map((f, i) => sello(f, c.emitidaEn, i === 0 ? -9 : 7, true))}</div>
            </div>
            <div class="burbujas solo-patrones"><span class="patron">Builder</span><span class="patron">Proxy</span><span class="patron">Flyweight</span><span class="patron">Singleton</span></div>
          </section>

          ${p.panel.length > 0
            ? h`<section class="bloque">
                <h2>Administración</h2>
                <p class="ayuda">Roles, personas registradas, servicios conectados y libro de auditoría.</p>
                <button class="boton boton--linea" data-ir="admin">Abrir el panel →</button>
              </section>`
            : ''}
        </div>

        <div class="perfil__columna">
          <section class="bloque">
            <h2>Lo que puedes hacer</h2>
            ${listaPermisos(p.rol.componentes ?? [])}
            <div class="burbujas solo-patrones"><span class="patron">Composite</span></div>
          </section>

          ${avisoInicio()}
        </div>

        <section class="bloque solo-patrones" style="grid-column: 1 / -1">
          <h2>Token de sesión (JWT)</h2>
          <div class="jwt"><span class="jwt__cabecera">${cabecera}</span>.<span class="jwt__cuerpo">${cuerpo}</span>.<span class="jwt__firma">${firma}</span></div>
          <pre>${JSON.stringify(decodificar(cuerpo), null, 2)}</pre>
        </section>
      </div>
    </div>`,
  );
}
