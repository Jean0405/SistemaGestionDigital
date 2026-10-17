/** Pruebas del Flyweight: compartir una sola instancia de tipo de documento. */
import { FabricaTiposDocumento } from '../src/application/documentos/fabrica-tipos-documento';
import { DocumentoIdentidad } from '../src/domain/documentos/documento-identidad';

// Valida el núcleo del patrón: el mismo código siempre devuelve la misma instancia.
test('FabricaTiposDocumento devuelve la misma instancia para el mismo código', () => {
  const a = FabricaTiposDocumento.obtener('CC');
  const b = FabricaTiposDocumento.obtener('CC');

  expect(a).toBe(b);
});

// Valida que cada tipo trae su propia regla de validación.
test('cada tipo de documento valida su propio formato', () => {
  const cc = FabricaTiposDocumento.obtener('CC');

  expect(cc.validar('1005184201')).toBe(true);
  expect(cc.validar('abc')).toBe(false);
});

// Valida el beneficio del patrón: muchos documentos del mismo tipo no multiplican las instancias.
test('muchos documentos del mismo tipo comparten una sola instancia', () => {
  const antes = FabricaTiposDocumento.cantidadCreados();
  const documentos = Array.from(
    { length: 50 },
    (_, i) => new DocumentoIdentidad(FabricaTiposDocumento.obtener('CC'), `100000000${i}`, `Ciudadano ${i}`),
  );

  const tiposDistintos = new Set(documentos.map((d) => d.tipo));
  expect(tiposDistintos.size).toBe(1);
  expect(FabricaTiposDocumento.cantidadCreados()).toBe(antes);
});
