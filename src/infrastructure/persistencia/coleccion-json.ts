import fs from 'fs';

/** Una lista de objetos guardada en un archivo JSON. `clave` es el campo que identifica a cada uno. */
export class ColeccionJson<T> {
  constructor(
    private readonly ruta: string,
    private readonly clave: keyof T,
  ) {}

  listar(): T[] {
    return fs.existsSync(this.ruta) ? JSON.parse(fs.readFileSync(this.ruta, 'utf8')) : [];
  }

  buscar(valor: string): T | undefined {
    return this.listar().find((item) => item[this.clave] === valor);
  }

  /** Agrega el objeto, o lo reemplaza si ya había uno con la misma clave. */
  guardar(nuevo: T): void {
    const items = this.listar();
    const posicion = items.findIndex((item) => item[this.clave] === nuevo[this.clave]);
    if (posicion >= 0) items[posicion] = nuevo;
    else items.push(nuevo);
    this.escribir(items);
  }

  eliminar(valor: string): void {
    this.escribir(this.listar().filter((item) => item[this.clave] !== valor));
  }

  private escribir(items: T[]): void {
    fs.writeFileSync(this.ruta, JSON.stringify(items, null, 2));
  }
}
