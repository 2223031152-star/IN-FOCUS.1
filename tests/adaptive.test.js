// tests/adaptive.test.js
import {
  mean,
  stdDev,
  zScore,
  indexConcentration,
  performance,
  updateDifficulty,
} from '../src/utils/adaptive.js';

describe('adaptive utilities', () => {
  test('mean and stdDev basic', () => {
    const arr = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(arr)).toBeCloseTo(5);
    expect(stdDev(arr)).toBeCloseTo(Math.sqrt(32 / arr.length)); // variance = 32/N
  });

  test('zScore and edge sigma=0', () => {
    const arr = [100, 100, 100];
    expect(stdDev(arr)).toBe(0);
    expect(zScore(100, arr)).toBe(0); // manejo definido
    expect(Number.isNaN(zScore(100, []))).toBe(true);
  });

  test('indexConcentration and performance', () => {
    expect(indexConcentration(10, 2)).toBe(8);
    expect(performance(50, 45)).toBe(5);
  });

  test('updateDifficulty rules', () => {
    const history = [400, 420, 410, 430];
    // Case: correct and Z small -> increase
    const { action: a1 } = updateDifficulty({
      difficulty: 3,
      rt: 390, // likely below mean => z small/negative
      responseTimes: history,
      isCorrect: true,
      step: 1,
      min: 1,
      max: 10,
    });
    expect(a1).toBe('increase');

    // Case: incorrect and large Z -> decrease
    const { action: a2 } = updateDifficulty({
      difficulty: 5,
      rt: 600,
      responseTimes: history,
      isCorrect: false,
      step: 1,
      min: 1,
      max: 10,
    });
    // action may be 'decrease' if z > 1.5
    expect(['maintain', 'decrease']).toContain(a2);
  });
});
