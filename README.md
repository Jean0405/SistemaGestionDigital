# Sistema de Gestión de Identidad Digital (SGID) - *ETAPA #0*

## Descripción general

Este proyecto corresponde al desarrollo de un sistema backend enfocado en el sector gobierno, cuyo propósito central es unificar la manera en que los ciudadanos acreditan su identidad frente a distintas entidades del Estado. En lugar de que cada dependencia gubernamental maneje su propio esquema de autenticación, el sistema plantea un componente único capaz de validar identidad mediante biometría multifactor, administrar roles y permisos, y exponer esa información de forma controlada a otros servicios públicos que la requieran.

## Justificación

La motivación de este trabajo surge de un problema bastante recurrente en la administración pública: los sistemas de identidad suelen estar dispersos entre distintas plataformas, cada una con su propio mecanismo de acceso, generalmente basado en credenciales simples (usuario y contraseña). Esto trae consigo varias dificultades:

- Mayor exposición a suplantación de identidad, dado lo débil de los mecanismos actuales.
- Necesidad de que el ciudadano gestione múltiples credenciales para trámites distintos.
- Poca capacidad de auditoría sobre quién accedió a qué información y en qué momento.
- Baja interoperabilidad entre las entidades del Estado, que terminan trabajando de forma aislada.

Frente a este panorama, se propone construir un sistema que centralice la verificación de identidad y que pueda ser consumido por otros sistemas gubernamentales mediante integraciones definidas, reduciendo así la duplicidad de esfuerzos y elevando el nivel de seguridad general.

## Objetivos del proyecto

- Implementar un mecanismo de autenticación biométrico que incorpore un segundo factor de verificación.
- Definir un esquema de roles y permisos que permita diferenciar el nivel de acceso según el tipo de usuario o entidad.
- Habilitar puntos de integración para que servicios gubernamentales externos puedan validar identidades a través del sistema.
- Ajustar el manejo de la información sensible a criterios de seguridad exigidos a nivel estatal.

## Funcionalidades contempladas

**Autenticación biométrica multifactor.** El acceso no depende únicamente de una contraseña, sino que se combina con verificación biométrica para reducir el riesgo de accesos no autorizados.

**Gestión de permisos y roles.** Se maneja un modelo de control de acceso basado en roles (RBAC), donde ciudadanos, administradores y entidades externas cuentan con distintos niveles de visibilidad y acción dentro del sistema.

**Integración con servicios gubernamentales.** El sistema expone una API pensada para que otras plataformas del Estado puedan consultar y validar identidades sin necesidad de reimplementar su propio mecanismo de autenticación.

**Cumplimiento de estándares de seguridad.** Se contempla cifrado de la información, registro de auditoría y trazabilidad de las operaciones que involucren datos sensibles del ciudadano.

## Actores involucrados

| Actor | Rol dentro del sistema |
|---|---|
| Ciudadano | Persona que se autentica y cuya identidad es gestionada por el sistema |
| Administrador | Encargado de configurar roles, permisos y supervisar el funcionamiento general |
| Entidad gubernamental externa | Sistema que consume la identidad verificada a través de la API |

## Enfoque arquitectónico

Para este proyecto se optó por el patrón **Hexagonal (Ports & Adapters)**. La razón detrás de esta elección tiene que ver con la naturaleza del sistema: al depender de múltiples integraciones externas (dispositivos biométricos, servicios de otras entidades, base de datos), resultaba conveniente aislar la lógica de negocio de los detalles técnicos de cada integración. De esta forma, el núcleo del sistema no depende directamente de ninguna tecnología específica, y los adaptadores pueden modificarse o reemplazarse sin alterar las reglas de negocio.

```
src/
├── domain/          # Entidades y reglas de negocio del sistema
├── application/     # Casos de uso y definición de puertos (interfaces)
├── infrastructure/  # Adaptadores concretos: base de datos, APIs externas, biometría
└── interfaces/      # Capa de entrada, controladores REST
```

## Tecnologías utilizadas

- Lenguaje: TypeScript
- Entorno de ejecución: Node.js
- Base de datos: PostgreSQL
- ORM: TypeORM
- Autenticación: JWT combinado con OAuth2 y un adaptador biométrico
- Pruebas: Jest

## Consideraciones no funcionales

Más allá de las funcionalidades propias del sistema, se tuvieron en cuenta ciertos aspectos que resultan igual de relevantes dado el contexto gubernamental del proyecto: la seguridad de la información (cifrado y auditoría), la disponibilidad del servicio, la capacidad de escalar conforme aumente el número de ciudadanos e integraciones, y la trazabilidad de cada operación realizada sobre la identidad de un usuario.

---

# ETAPA 2 — Patrón Singleton (primera funcionalidad)

En esta etapa se armó la primera parte con código del sistema y se le aplicó
el patrón **Singleton**.

## Qué se hizo

Se construyó un **Gestor de Configuración** (`ConfigManager`): la pieza que
guarda los datos que el sistema necesita para arrancar (puerto de la API,
clave de los tokens, datos de la base de datos, qué tan exigente es la
verificación biométrica). Los lee **una sola vez** al inicio y después se los
pasa igual a cualquier parte del sistema que se los pida.

## Por qué Singleton

Porque la configuración tiene que ser **una sola para todos**. Si cada módulo
armara la suya, podrían terminar trabajando con datos distintos. El Singleton
asegura que exista una única copia, que se crea la primera vez que hace falta
y a la que siempre se llega por el mismo lado (`ConfigManager.getInstance()`).

## Cómo incide en el código

- Todos los módulos leen la configuración del mismo lugar, así que no hay
  descuadres entre unos y otros.
- Los datos se leen y se revisan una sola vez, no cada rato.
- No hay que andar pasando la configuración de un lado a otro por parámetros.
- Si algún día cambia de dónde salen esos datos, se ajusta solo dentro del
  gestor y nada más.

Ejemplo dentro del proyecto: el `VerificadorBiometrico` no tiene el umbral
escrito a mano en el código, se lo pide al gestor.

## Documentación detallada

Explicación completa y con calma (qué es el patrón, cómo afecta al código,
ventajas y cosas a tener en cuenta): [`docs/ETAPA-2-Singleton.md`](docs/ETAPA-2-Singleton.md)

## Cómo ejecutar

```bash
npm install       # instalar dependencias
npm test          # correr las pruebas
npm run build     # compilar
node dist/index.js  # ver la demostración
```

## Pruebas / Testing

Las pruebas están en [`tests/`](tests) y se ejecutan con `npm test`.
Cubren el comportamiento del patrón (instancia única, carga única,
inmutabilidad, validaciones) y su uso desde otro módulo.

Estado actual: **12 pruebas, todas en verde.**

## Archivos añadidos en esta etapa

```
src/infrastructure/config/config-manager.ts     # El Singleton
src/application/auth/verificador-biometrico.ts   # Módulo que lo consume
src/index.ts                                     # Demostración
tests/config-manager.test.ts                     # Pruebas del patrón
tests/verificador-biometrico.test.ts             # Pruebas del uso
```

---

# ETAPA 3 — Patrón Factory Method (autenticación multifactor)

En esta etapa se sumó la **autenticación multifactor** y se le aplicó el
patrón **Factory Method**.

## En una frase

El sistema comprueba la identidad combinando tres factores:

| Factor | Tipo | Cómo se comprueba |
|---|---|---|
| Contraseña | *algo que sabes* | Coincide con la contraseña registrada del usuario |
| Token al teléfono | *algo que tienes* | Coincide con el código enviado por SMS y todavía vigente (5 min) |
| Rostro | *algo que eres* | El puntaje del sensor facial alcanza el umbral configurado |

El **procedimiento** para validar un factor es siempre el mismo; lo único que
cambia es *qué factor* se usa. Esa elección es la que resuelve el Factory
Method.

## ¿Qué es el patrón Factory Method? (contado fácil)

Piensa en una oficina de trámites con varias ventanillas. El **procedimiento**
es idéntico en todas: pides turno, entregas tus datos, te dan un resultado. Lo
que cambia es la **herramienta** de cada ventanilla: una revisa contraseñas,
otra códigos de SMS, otra tiene la cámara.

El Factory Method es esa idea en código:

1. Una clase "madre" (**el Creador**) define el procedimiento completo.
2. En medio de ese procedimiento hay **un hueco**: "aquí va el factor", pero
   la clase madre no dice cuál.
3. Cada **subclase** rellena ese hueco devolviendo el factor que le toca.

La clase madre nunca escribe `new FactorContrasena()`. Solo llama a su método
`crearFactor()` y confía en que la subclase lo resuelva.

## Los papeles del patrón en el proyecto

| Papel en el patrón | En el código |
|---|---|
| Creador (abstracto) | `FlujoAutenticacion` |
| Método fábrica | `crearFactor()` |
| Creadores concretos | `FlujoContrasena`, `FlujoTokenTelefono`, `FlujoRostro` |
| Producto (interfaz) | `FactorAutenticacion` |
| Productos concretos | `FactorContrasena`, `FactorTokenTelefono`, `FactorRostro` |

El **procedimiento común** vive en `FlujoAutenticacion.autenticar()`: limpia la
entrada, corta si viene vacía, ejecuta el factor y devuelve un resultado con
la misma forma para todos (`factor`, `autenticado`, `motivo`).

Cada **factor** guarda su propia regla:

- `FactorContrasena` compara contra la contraseña registrada.
- `FactorTokenTelefono` compara el código **y** revisa que no haya expirado.
- `FactorRostro` compara el puntaje facial contra el umbral, que **no está
  escrito ahí**: lo pide al Gestor de Configuración (el Singleton de la
  ETAPA 2).

## ¿Cómo incide (afecta) este patrón en el código?

### Sin Factory Method

El flujo tendría un `switch` que hay que reabrir con cada factor nuevo:

```ts
if (tipo === 'contraseña') { /* crea y usa contraseña */ }
else if (tipo === 'token') { /* crea y usa token */ }
else if (tipo === 'rostro') { /* crea y usa rostro */ }
```

La lógica de "cómo se autentica" queda mezclada con la de "qué factor es", y
cada cambio arriesga romper lo que ya funcionaba.

### Con Factory Method

- **El procedimiento se escribe una sola vez**, en `FlujoAutenticacion`.
- **Agregar un factor es agregar una clase** (por ejemplo, una llave física
  USB): no se toca lo existente (principio abierto/cerrado).
- **Cada factor guarda su regla en su propio archivo**, sin estorbar a los
  demás.
- **El resto del sistema trata a todos los flujos igual**: recibe un
  `FlujoAutenticacion` y llama a `autenticar()`, sin saber cuál es. Eso es lo
  que permite el intento multifactor: recorrer una lista de flujos distintos
  con el mismo código.

### Conexión con la ETAPA 2

`FactorRostro` no tiene el umbral escrito a mano:

```ts
const umbral = ConfigManager.getInstance().obtener('biometriaUmbralMinimo');
const superado = puntaje >= umbral;
```

El **Singleton** garantiza que ese umbral sea único para todo el sistema y el
**Factory Method** lo aplica dentro del factor facial sin que el flujo se
entere.

## Dónde encaja en la arquitectura hexagonal

Productos y creadores viven en la capa de **aplicación** (`application/auth`):
orquestan el caso de uso "autenticar a una persona" y, en el caso del rostro,
consultan la configuración. La capa de infraestructura solo aporta ese dato.

## Cosas a tener en cuenta del Factory Method

| Punto flojo | Qué se hizo aquí |
|---|---|
| Aparecen varias clases pequeñas (una por producto y otra por creador) | Se aceptó a cambio de que cada archivo sea corto y de una sola responsabilidad |
| Puede ser exagerado si solo hubiera un factor | Aquí hay tres reales y se esperan más, así que se justifica |
| El creador podría cargarse de lógica | `FlujoAutenticacion` solo limpia la entrada y arma el resultado; la regla de cada factor está en su propia clase |

## Pruebas / Testing

Las pruebas nuevas están en [`tests/`](tests):

**`tests/factores-autenticacion.test.ts`** — cada factor (Producto) por separado:

| Prueba | Qué revisa |
|---|---|
| Contraseña | Se acepta solo si coincide con la registrada |
| Token al teléfono | Vale solo si es el código enviado y no expiró |
| Rostro | Se mide contra el umbral que entrega el Singleton |

**`tests/flujo-autenticacion.test.ts`** — el Factory Method:

| Prueba | Qué revisa |
|---|---|
| Creación del factor | `crearFactor()` devuelve el producto correcto en cada subclase |
| Paso común | El creador rechaza una entrada vacía sin ejecutar el factor |
| Factory Method + Singleton | Si cambia el umbral en config, el flujo de rostro cambia su decisión |
| Uso polimórfico | Un mismo código recorre los tres flujos en un intento multifactor |

Estado actual: **19 pruebas, todas en verde** (12 de la ETAPA 2 + 7 nuevas).

![alt text](image.png)

## Archivos añadidos en esta etapa

```
src/application/auth/factor-autenticacion.ts     # Contrato (Producto) + ResultadoFactor
src/application/auth/factor-contrasena.ts         # Producto concreto
src/application/auth/factor-token-telefono.ts     # Producto concreto
src/application/auth/factor-rostro.ts             # Producto concreto (usa el Singleton)
src/application/auth/flujo-autenticacion.ts        # Creador abstracto (define el Factory Method)
src/application/auth/flujo-contrasena.ts           # Creador concreto
src/application/auth/flujo-token-telefono.ts       # Creador concreto
src/application/auth/flujo-rostro.ts               # Creador concreto
tests/factores-autenticacion.test.ts              # Pruebas de los Productos
tests/flujo-autenticacion.test.ts                 # Pruebas del Factory Method
```

---

## Autor
Keanon Jeanpierre Angarita Olarte
