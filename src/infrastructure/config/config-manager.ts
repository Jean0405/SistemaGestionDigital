/**
 * Gestor de Configuración del sistema SGID.
 *
 * Este archivo implementa el patrón Singleton: garantiza que en toda la
 * aplicación exista UNA sola instancia encargada de leer y entregar los
 * valores de configuración (puerto de la API, secreto para los tokens,
 * datos de la base de datos, umbral de la verificación biométrica, etc.).
 *
 * La configuración se lee una única vez desde las variables de entorno
 * cuando alguien pide la instancia por primera vez. A partir de ahí,
 * cualquier parte del sistema recibe exactamente los mismos valores.
 */

/** Forma de los valores de configuración que maneja el sistema. */
export interface ConfiguracionSGID {
  entorno: 'development' | 'test' | 'production';
  puertoApi: number;
  jwtSecret: string;
  jwtExpiracionMinutos: number;
  biometriaUmbralMinimo: number; // valor entre 0 y 1
  db: {
    host: string;
    puerto: number;
    nombre: string;
  };
}

export class ConfigManager {
  /** Única instancia de la clase. Empieza vacía y se crea cuando se necesita. */
  private static instancia: ConfigManager | null = null;

  /** Valores de configuración ya cargados y protegidos contra cambios. */
  private readonly config: ConfiguracionSGID;

  /**
   * El constructor es privado: nadie puede escribir `new ConfigManager()`
   * desde fuera. La única puerta de entrada es `getInstance()`.
   */
  private constructor() {
    this.config = ConfigManager.leerConfiguracion();
  }

  /**
   * Devuelve la instancia única. Si todavía no existe, la crea;
   * si ya existe, devuelve la misma de siempre.
   */
  public static getInstance(): ConfigManager {
    if (ConfigManager.instancia === null) {
      ConfigManager.instancia = new ConfigManager();
    }
    return ConfigManager.instancia;
  }

  /** Entrega todos los valores de configuración (solo lectura). */
  public obtenerTodo(): ConfiguracionSGID {
    return this.config;
  }

  /** Entrega un valor puntual de configuración por su nombre. */
  public obtener<K extends keyof ConfiguracionSGID>(clave: K): ConfiguracionSGID[K] {
    return this.config[clave];
  }

  /**
   * Vuelve a dejar el gestor "en cero". Sirve únicamente para las pruebas,
   * donde cada test necesita partir de un estado limpio.
   */
  public static reiniciar(): void {
    ConfigManager.instancia = null;
  }

  /**
   * Lee las variables de entorno, aplica valores por defecto cuando faltan,
   * valida lo esencial y devuelve el objeto ya congelado.
   */
  private static leerConfiguracion(): ConfiguracionSGID {
    const entorno = (process.env.NODE_ENV ?? 'development') as ConfiguracionSGID['entorno'];

    const config: ConfiguracionSGID = {
      entorno,
      puertoApi: Number(process.env.API_PORT ?? 3000),
      jwtSecret: process.env.JWT_SECRET ?? 'clave-de-desarrollo-no-usar-en-produccion',
      jwtExpiracionMinutos: Number(process.env.JWT_EXPIRACION_MIN ?? 15),
      biometriaUmbralMinimo: Number(process.env.BIOMETRIA_UMBRAL ?? 0.85),
      db: {
        host: process.env.DB_HOST ?? 'localhost',
        puerto: Number(process.env.DB_PORT ?? 5432),
        nombre: process.env.DB_NAME ?? 'sgid',
      },
    };

    ConfigManager.validar(config);

    // Se congela para que ninguna parte del sistema pueda modificar
    // la configuración por accidente en tiempo de ejecución.
    Object.freeze(config);
    Object.freeze(config.db);
    return config;
  }

  /** Comprueba que los valores mínimos tengan sentido. */
  private static validar(config: ConfiguracionSGID): void {
    if (!Number.isInteger(config.puertoApi) || config.puertoApi <= 0) {
      throw new Error(`Configuración inválida: API_PORT debe ser un número positivo (recibido: ${config.puertoApi}).`);
    }

    if (config.jwtSecret.trim().length < 10) {
      throw new Error('Configuración inválida: JWT_SECRET debe tener al menos 10 caracteres.');
    }

    if (config.biometriaUmbralMinimo < 0 || config.biometriaUmbralMinimo > 1) {
      throw new Error(`Configuración inválida: BIOMETRIA_UMBRAL debe estar entre 0 y 1 (recibido: ${config.biometriaUmbralMinimo}).`);
    }

    if (config.entorno === 'production' && config.jwtSecret.startsWith('clave-de-desarrollo')) {
      throw new Error('Configuración inválida: en producción debe definirse un JWT_SECRET propio.');
    }
  }
}
