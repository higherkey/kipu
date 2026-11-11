import { describe, it, expect } from 'vitest';
import { PawanaCurriculum } from '../src/games/pawana/PawanaCurriculum';

describe('PawanaCurriculum', () => {
  it('should generate numbers questions sequentially on easy', () => {
    const q1 = PawanaCurriculum.generateQuestion('numbers', 'easy', 0, 0.2);
    expect(q1.mode).toBe('numbers');
    expect(q1.topOption).toBeDefined();
    expect(q1.bottomOption).toBeDefined();
    // One must be correct
    expect(q1.topOption.isCorrect || q1.bottomOption.isCorrect).toBe(true);
    // At step 0, target is 1
    const correctOpt = q1.topOption.isCorrect ? q1.topOption : q1.bottomOption;
    expect(correctOpt.text).toBe('1');
  });

  it('should generate skip counting questions on normal', () => {
    const q2 = PawanaCurriculum.generateQuestion('numbers', 'normal', 1, 0.8);
    expect(q2.mode).toBe('numbers');
    // Step index 1 -> (1+1)*2 = 4
    const correctOpt = q2.topOption.isCorrect ? q2.topOption : q2.bottomOption;
    expect(correctOpt.text).toBe('4');
  });

  it('should generate spelling questions matching target word letters', () => {
    // Step 0 of first word (LLAMA) -> letter L
    const q = PawanaCurriculum.generateQuestion('spelling', 'normal', 0, 0.4);
    expect(q.mode).toBe('spelling');
    const correctOpt = q.topOption.isCorrect ? q.topOption : q.bottomOption;
    expect(correctOpt.text).toBe('L');
    expect(q.prompt).toContain('LLAMA');
  });

  it('should generate shapes & pattern sequence questions', () => {
    const q = PawanaCurriculum.generateQuestion('shapes', 'normal', 0, 0.2);
    expect(q.mode).toBe('shapes');
    const correctOpt = q.topOption.isCorrect ? q.topOption : q.bottomOption;
    expect(correctOpt.shape).toBeDefined();
    expect(correctOpt.color).toBeDefined();
  });

  it('should support choice vs nothing (empty sky) mechanics where empty is correct', () => {
    // In easy mode at stepIndex 2 with seed having ((seed * 10) % 2 < 1)
    const q = PawanaCurriculum.generateQuestion('numbers', 'easy', 2, 0.05);
    const hasEmpty = q.topOption.isEmpty || q.bottomOption.isEmpty;
    expect(hasEmpty).toBe(true);
    const emptyOpt = q.topOption.isEmpty ? q.topOption : q.bottomOption;
    expect(emptyOpt.isCorrect).toBe(true);
  });

  it('should advance smoothly across multi-word boundaries in spelling without character desynchronization', () => {
    // LLAMA is 5 letters (indices 0..4)
    const qLlamaEnd = PawanaCurriculum.generateQuestion('spelling', 'normal', 4, 0.2);
    expect(qLlamaEnd.prompt).toContain('LLAMA');
    const opt4 = qLlamaEnd.topOption.isCorrect ? qLlamaEnd.topOption : qLlamaEnd.bottomOption;
    expect(opt4.text).toBe('A');

    // Step index 5 must cleanly transition to CONDOR (first letter 'C')
    const qCondorStart = PawanaCurriculum.generateQuestion('spelling', 'normal', 5, 0.2);
    expect(qCondorStart.prompt).toContain('CONDOR');
    const opt5 = qCondorStart.topOption.isCorrect ? qCondorStart.topOption : qCondorStart.bottomOption;
    expect(opt5.text).toBe('C');
  });
});
