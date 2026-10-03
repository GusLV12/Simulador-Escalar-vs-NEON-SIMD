# Simulador escalar vs. NEON mejorado

Abre **index.html** con doble clic en Chrome, Edge o Firefox. Conserva todos los archivos de esta carpeta juntos. No necesita servidor, Internet ni instalar dependencias. El HTML original del profesor permanece en la carpeta superior.

## Uso

1. Elige `float32`, `int16` o `uint8`. Cambiar el tipo o la longitud genera un nuevo experimento.
2. Escribe A y B y pulsa **Aplicar datos**, o selecciona un ejemplo y pulsa **Cargar ejemplo**. Los ejemplos corresponden al tipo seleccionado.
3. Usa **Un paso** o **Reproducir / Pausar**. Cada paso avanza una suma escalar y una suma en la ruta vectorial, mientras esa ruta tenga trabajo pendiente.
4. **Reiniciar ejecución** conserva los datos aplicados; **Generar datos** crea números nuevos. Los cambios de texto solo se aplican con el botón Aplicar datos.
5. **Un paso** y **Reproducir** desplazan la página a la traza de ejecución.

Introduce entre 1 y 40 números en cada arreglo, con longitudes iguales. Separa los números con comas, espacios o saltos de línea; usa punto decimal. `uint8` admite enteros de 0 a 255; `int16`, de −32768 a 32767. `float32` admite entradas finitas que sigan siendo finitas al convertirlas a esa precisión; valores muy pequeños pueden redondearse a cero. Los errores se muestran junto al campo y no aplican los datos. Si el experimento estaba reproduciéndose, continuará con sus datos anteriores.

## Las cuatro mejoras

- Reiniciar conserva A y B; generar datos es una acción separada.
- Entrada manual y tres ejemplos por tipo: grupo completo, grupo con residuo y valores límite.
- Motor separado de la pantalla y pruebas de cada ruta contra respuestas conocidas. La coincidencia entre rutas se informa por separado.
- Etiquetas de pasos e instrucciones de suma, con explicación explícita del alcance del conteo.

`engine.js` valida entradas y ejecuta el cálculo; `app.js` controla la pantalla y la reproducción; `tests.js` contiene los casos independientes. `control-tests.cjs` verifica los controles con un DOM mínimo y temporizadores simulados en Node, sin dependencias.

## Pruebas y resultados

Las 53 pruebas del motor se ejecutan desde la terminal e incluyen un recorrido de los 120 casos de tipo y longitud permitidos. Desde la carpeta superior, si tienes Node:

```sh
node simulador-mejorado/tests.js
node simulador-mejorado/control-tests.cjs
```

Se comprueban longitudes menores que un grupo, grupos completos y residuos para los tres tipos; correspondencia por índice; desbordamiento entero; redondeo float32; entradas inválidas; y conteos. Los resultados esperados son constantes declaradas en las pruebas: no se obtienen llamando a la función de suma que se está probando.

Ejemplos: `float32`, N=16, debe finalizar con 16 sumas escalares y 4 vectoriales. N=17 debe finalizar con 17 sumas escalares y una ruta NEON de 4 vectoriales + 1 escalar de residuo. Para reproducirlos manualmente, introduce 16 o 17 valores `2` en A y la misma cantidad de valores `3` en B: todos los resultados deben ser `5`.

Las pruebas de controles verifican pausa, reinicio, datos manuales, ejemplos, temporizadores, estados finales, solicitudes de desplazamiento y el signo del cero en float32. No verifican el renderizado de un navegador. Para revisión manual: abre index.html, prueba Reproducir, Un paso y Reiniciar, y aplica un arreglo inválido para ver su mensaje de error.

## Alcance del modelo

Se representa C[i] = A[i] + B[i]. Los registros de 128 bits contienen 4 elementos float32, 8 int16 o 16 uint8. Se forman grupos completos y el residuo se procesa escalarmente. Para N elementos y L carriles, la ruta NEON cuenta `floor(N/L)` sumas vectoriales y `N % L` sumas escalares de residuo.

Los enteros usan desbordamiento modular de 8 o 16 bits. Float32 redondea entradas y resultados con `Math.fround`; una suma de entradas finitas puede desbordar a infinito. No es una emulación completa de los modos especiales de punto flotante de ARM. El ADD escalar dibujado es ilustrativo y no incluye conversiones ni almacenamiento del resultado reducido a 8 o 16 bits.

La relación de instrucciones compara únicamente sumas: omite cargas, almacenamientos, control del bucle, pipeline y latencias. No mide ciclos, tiempos ni aceleración real. JavaScript no ejecuta instrucciones ARM/NEON. Las pruebas validan este modelo de software, no certifican equivalencia completa con un Allwinner A20 físico.

Referencias del proyecto: el simulador HTML original, la consigna en `Análisis_pcduino3.ipynb` y `A20-Brief-2013-02-27.pdf`, conservados en la carpeta superior. La validación realizada en esta versión corresponde al cálculo y a los controles de software.
