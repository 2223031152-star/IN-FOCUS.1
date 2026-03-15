// examples/usage.js
import {
  mean,
  stdDev,
  zScore,
  indexConcentration,
  performance,
  updateDifficulty,
} from '../src/utils/adaptive.js';

const responseTimes = [420, 380, 400, 410, 390]; // ms
const rt = 365;
const isCorrect = true;
const difficulty = 3; // escala arbitraria

console.log('μ =', mean(responseTimes));
console.log('σ =', stdDev(responseTimes));
console.log('Z =', zScore(rt, responseTimes));
console.log('IC ejemplo =', indexConcentration(45, 3)); // TA=45, E=3
console.log('R ejemplo =', performance(100, 95)); // TNs=100, TE=95

const result = updateDifficulty({
  difficulty,
  rt,
  responseTimes,
  isCorrect,
  step: 1,
  min: 1,
  max: 10,
});
console.log('updateDifficulty ->', result);
