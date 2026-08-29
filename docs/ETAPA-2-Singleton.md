# ETAPA 2 — Patrón Singleton en el Gestor de Configuración

## En una frase

En esta etapa se armó la primera parte con código del sistema: un **Gestor de
Configuración** que carga los datos que el programa necesita una sola vez y
se los entrega igual a quien se los pida. Para lograr ese "una sola vez y
para todos" se usó el patrón **Singleton**.

---

## ¿Qué es el patrón Singleton? (contado fácil)

Piensa en el tablero de control de un edificio: hay **uno solo**, está en un
lugar conocido y todos van ahí a mirarlo. No tendría sentido que cada oficina
armara su propio tablero con datos distintos.

El Singleton es esa misma idea llevada al código:

1. **Hay una sola copia** del objeto en todo el programa.
2. **Siempre se llega a ella por la misma puerta** (un método llamado
   `getInstance()`).
3. **Nadie puede crear otra copia** por su cuenta, porque la forma normal de
   crear objetos (`new`) está bloqueada desde afuera.

La primera vez que alguien la pide, se crea. De ahí en adelante, todos
reciben esa misma.

---

## ¿Qué hace nuestro Gestor de Configuración?

El sistema necesita varios datos para funcionar: en qué puerto responde la
API, cuál es la clave para firmar los tokens de sesión, los datos para
conectarse a la base de datos y qué tan parecida tiene que ser una lectura
biométrica para darla por buena.

Esos datos vienen de las **variables de entorno** del servidor. El gestor:

1. Las lee **una sola vez**, cuando el sistema arranca.
2. Si falta alguna, pone un **valor por defecto** razonable.
3. **Revisa que todo tenga sentido** (que el puerto sea un número positivo,
   que el umbral biométrico esté entre 0 y 1, etc.). Si algo está mal, corta
   el arranque con un mensaje claro en vez de fallar más adelante y dejar
   adivinando qué pasó.
4. **Deja los valores "en solo lectura"** para que ningún módulo los cambie
   sin querer mientras el sistema está andando.

Archivo principal: [`src/infrastructure/config/config-manager.ts`](../src/infrastructure/config/config-manager.ts)

---

## ¿Cómo incide (afecta) este patrón en el código?

### Sin Singleton

Cada módulo tendría que leer las variables de entorno por su lado, repetir la
misma revisión y arriesgarse a entender un valor distinto al que entendió
otro módulo. Además, habría que ir pasando la configuración "de mano en mano"
por todos lados.

### Con Singleton

- **Un solo lugar de donde salen los datos.** Todos leen de ahí, así que es
  imposible que dos partes del sistema anden con configuraciones distintas.
- **La lectura y la revisión pasan una sola vez.** No se repite el trabajo.
- **Se usa fácil desde cualquier parte:**
  `ConfigManager.getInstance().obtener('puertoApi')`. No hay que pasar la
  configuración por parámetros por toda la aplicación.
- **Un solo sitio para cambios futuros.** Si mañana la configuración se lee
  de un archivo o de un servicio externo, se cambia solo dentro del gestor y
  el resto del sistema ni se entera.

### Ejemplo real dentro del proyecto

El `VerificadorBiometrico`
([`src/application/auth/verificador-biometrico.ts`](../src/application/auth/verificador-biometrico.ts))
decide si una huella o un rostro coinciden. No tiene el umbral escrito a mano
ni lo recibe por parámetro: se lo pide al gestor.

```ts
const umbral = ConfigManager.getInstance().obtener('biometriaUmbralMinimo');
return puntajeSimilitud >= umbral;
```

Si mañana se sube o baja la exigencia de la biometría, se cambia una variable
de entorno y **todo el sistema** queda al día sin tocar el verificador.

---

## Dónde encaja en la arquitectura hexagonal

El gestor vive en la capa de **infraestructura** (`infrastructure/config`),
porque su trabajo es hablar con el "mundo de afuera" (las variables de
entorno). Las capas de **aplicación** y **dominio** solo lo consultan; no
saben de dónde salen realmente los valores.

---

## Cosas a tener en cuenta del Singleton

El patrón es cómodo pero tiene sus peros, y por eso se tomaron algunas
precauciones:

| Punto flojo | Qué se hizo aquí |
|---|---|
| Es un dato "global" que puede enredar las pruebas | Se agregó un método `reiniciar()` para que cada prueba empiece limpia |
| Puede esconder de quién depende un módulo | Se documenta y se usa solo para configuración, no para lógica del negocio |
| Si se le meten muchas responsabilidades, se vuelve un cajón desordenado | El gestor **solo** se encarga de la configuración |

---

## Pruebas / Testing

Las pruebas están en la carpeta [`tests/`](../tests) y se corren con:

```bash
npm install
npm test
```

### Qué se comprueba

**`tests/config-manager.test.ts`** — el patrón en sí:

| Prueba | Qué revisa |
|---|---|
| Misma instancia | `getInstance()` siempre devuelve el mismo objeto |
| Carga única | Cambiar una variable de entorno *después* de crear la instancia no cambia lo que ya se leyó |
| Valores por defecto | Si falta una variable, se usa el valor previsto |
| Solo lectura | No se puede cambiar la configuración en caliente |
| `reiniciar()` | Permite volver a empezar (lo usan las pruebas) |
| Validaciones | Rechaza puerto inválido, clave muy corta, umbral fuera de rango y falta de clave propia en producción |

**`tests/verificador-biometrico.test.ts`** — el patrón en uso:

| Prueba | Qué revisa |
|---|---|
| Acepta / rechaza según el umbral | El verificador usa el valor que le da el gestor |
| Cambia el umbral → cambia la decisión | Confirma que la configuración es la que manda |

### Resultado actual

```
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
```

---

## Estructura de archivos de esta etapa

```
src/
├── infrastructure/
│   └── config/
│       └── config-manager.ts        # El Singleton (Gestor de Configuración)
├── application/
│   └── auth/
│       └── verificador-biometrico.ts # Ejemplo de módulo que lo usa
└── index.ts                          # Demostración que se puede ejecutar

tests/
├── config-manager.test.ts            # Pruebas del patrón
└── verificador-biometrico.test.ts    # Pruebas del uso del patrón
```

## Autor

Keanon Jeanpierre Angarita Olarte
