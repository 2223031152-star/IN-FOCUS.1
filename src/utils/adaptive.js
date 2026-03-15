// src/utils/adaptive.js
/**
 * Funciones estadísticas y algoritmo adaptativo para la tarea de Visual Search.
 *
 * Se usan exactamente las fórmulas proporcionadas por el usuario:
 * 1) MEDIA: μ = suma(RT) / N
 * 2) DESVIACIÓN ESTÁNDAR (poblacional): σ = sqrt( suma( (RT - μ)^2 ) / N )
 * 3) Z SCORE: Z = (RT - μ) / σ
 * 4) ÍNDICE DE CONCENTRACIÓN: IC = TA - E
 * 5) RENDIMIENTO: R = TNs - TE
 *
 * Reglas adaptativas (implementadas tal cual):
 * - Si respuesta correcta y Z < 0.5 -> aumentar dificultad
 * - Si respuesta correcta y 0.5 ≤ Z ≤ 1.5 -> mantener dificultad
 * - Si respuesta incorrecta y Z < 1.5 -> mantener dificultad
 * - Si respuesta incorrecta y Z > 1.5 -> disminuir dificultad
 *
 * Notas de manejo de casos límite:
 * - Si el array de tiempos está vacío, mean/stdDev devuelven NaN.
 * - Si σ === 0 (todos los RT iguales), zScore devuelve 0 (evita división por cero).
 */

/**
 * Calcula la media (μ) de un arreglo de tiempos de respuesta.
 * @param {number[]} responseTimes
 * @returns {number} media (NaN si el array está vacío).
 */
export function mean(responseTimes) {
  const n = responseTimes.length;
  if (n === 0) return NaN;
  const sum = responseTimes.reduce((acc, v) => acc + v, 0);
  return sum / n;
}

/**
 * Calcula la desviación estándar poblacional (σ).
 * Fórmula: sqrt( suma( (RT - μ)^2 ) / N )
 * @param {number[]} responseTimes
 * @returns {number} desviación estándar (NaN si el array está vacío).
 */
export function stdDev(responseTimes) {
  const n = responseTimes.length;
  if (n === 0) return NaN;
  const mu = mean(responseTimes);
  const sumSquares = responseTimes.reduce((acc, v) => {
    const diff = v - mu;
    return acc + diff * diff;
  }, 0);
  const variance = sumSquares / n; // poblacional
  return Math.sqrt(variance);
}

/**
 * Calcula el Z score: Z = (RT - μ) / σ
 * Comportamiento en casos límite:
 * - Si μ o σ son NaN -> devuelve NaN.
 * - Si σ === 0 -> devuelve 0 (evita división por cero).
 *
 * @param {number} rt
 * @param {number[]} responseTimes
 * @returns {number} Z score
 */
export function zScore(rt, responseTimes) {
  const mu = mean(responseTimes);
  const sigma = stdDev(responseTimes);
  if (Number.isNaN(mu) || Number.isNaN(sigma)) return NaN;
  if (sigma === 0) return 0;
  return (rt - mu) / sigma;
}

/**
 * Índice de concentración: IC = TA - E
 * @param {number} TA
 * @param {number} E
 * @returns {number} IC
 */
export function indexConcentration(TA, E) {
  return TA - E;
}

/**
 * Rendimiento: R = TNs - TE
 * @param {number} TNs
 * @param {number} TE
 * @returns {number} R
 */
export function performance(TNs, TE) {
  return TNs - TE;
}

/**
 * Actualiza la dificultad usando las reglas adaptativas dadas.
 *
 * Parámetros (objeto):
 * - difficulty: número actual de dificultad
 * - rt: tiempo de respuesta del ensayo actual
 * - responseTimes: arreglo con tiempos previos
 * - isCorrect: boolean
 * - step (default 1)
 * - min (default 1)
 * - max (default 10)
 *
 * Devuelve: { difficulty, action, z }
 */
export function updateDifficulty({
  difficulty,
  rt,
  responseTimes,
  isCorrect,
  step = 1,
  min = 1,
  max = 10,
}) {
  const z = zScore(rt, responseTimes);

  let newDifficulty = difficulty;
  let action = 'maintain';

  if (isCorrect && z < 0.5) {
    newDifficulty = difficulty + step;
    action = 'increase';
  } else if (isCorrect && z >= 0.5 && z <= 1.5) {
    action = 'maintain';
  } else if (!isCorrect && z < 1.5) {
    action = 'maintain';
  } else if (!isCorrect && z > 1.5) {
    newDifficulty = difficulty - step;
    action = 'decrease';
  }

  if (newDifficulty > max) newDifficulty = max;
  if (newDifficulty < min) newDifficulty = min;

  return { difficulty: newDifficulty, action, z };
}
