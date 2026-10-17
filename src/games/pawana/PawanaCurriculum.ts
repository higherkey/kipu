export type PawanaMode = 'numbers' | 'spelling' | 'shapes';
export type PawanaDifficulty = 'easy' | 'normal' | 'hard';

export interface GateOption {
  text: string;
  isCorrect: boolean;
  shape?: 'circle' | 'square' | 'triangle' | 'star';
  color?: string;
  isEmpty?: boolean;
}

export interface GateQuestion {
  prompt: string;
  subPrompt?: string;
  mode: PawanaMode;
  topOption: GateOption;
  bottomOption: GateOption;
  stepIndex: number;
  totalSteps: number;
}

const SPELLING_WORDS = [
  { word: 'LLAMA', clue: 'Friendly mountain friend' },
  { word: 'CONDOR', clue: 'King of Andean skies' },
  { word: 'PUMA', clue: 'Swift mountain cat' },
  { word: 'VICUNA', clue: 'Golden highland grazer' },
  { word: 'INTI', clue: 'The golden sun' },
  { word: 'KIPU', clue: 'Sacred talking knots' },
  { word: 'ANDES', clue: 'Mighty mountain range' },
  { word: 'ALPAKA', clue: 'Fluffy wool companion' },
];

const SHAPE_PATTERNS: Array<{
  name: string;
  sequence: Array<{ shape: 'circle' | 'square' | 'triangle' | 'star'; color: string; label: string }>;
}> = [
  {
    name: 'Sun & Sky',
    sequence: [
      { shape: 'star', color: '#F1C40F', label: 'Star' },
      { shape: 'circle', color: '#3498DB', label: 'Circle' },
      { shape: 'star', color: '#F1C40F', label: 'Star' },
      { shape: 'circle', color: '#3498DB', label: 'Circle' },
      { shape: 'star', color: '#F1C40F', label: 'Star' },
      { shape: 'circle', color: '#3498DB', label: 'Circle' },
    ]
  },
  {
    name: 'Earth & Meadow',
    sequence: [
      { shape: 'square', color: '#E67E22', label: 'Square' },
      { shape: 'triangle', color: '#2ECC71', label: 'Triangle' },
      { shape: 'square', color: '#E67E22', label: 'Square' },
      { shape: 'triangle', color: '#2ECC71', label: 'Triangle' },
      { shape: 'square', color: '#E67E22', label: 'Square' },
      { shape: 'triangle', color: '#2ECC71', label: 'Triangle' },
    ]
  },
  {
    name: 'Rainbow Triad',
    sequence: [
      { shape: 'circle', color: '#E74C3C', label: 'Circle' },
      { shape: 'square', color: '#F1C40F', label: 'Square' },
      { shape: 'triangle', color: '#9B59B6', label: 'Triangle' },
      { shape: 'circle', color: '#E74C3C', label: 'Circle' },
      { shape: 'square', color: '#F1C40F', label: 'Square' },
      { shape: 'triangle', color: '#9B59B6', label: 'Triangle' },
    ]
  }
];

export class PawanaCurriculum {
  public static generateQuestion(
    mode: PawanaMode,
    difficulty: PawanaDifficulty,
    stepIndex: number,
    seed = Math.random()
  ): GateQuestion {
    switch (mode) {
      case 'numbers':
        return this.generateNumbersQuestion(difficulty, stepIndex, seed);
      case 'spelling':
        return this.generateSpellingQuestion(difficulty, stepIndex, seed);
      case 'shapes':
        return this.generateShapesQuestion(difficulty, stepIndex, seed);
    }
  }

  private static generateNumbersQuestion(
    difficulty: PawanaDifficulty,
    stepIndex: number,
    seed: number
  ): GateQuestion {
    const totalSteps = difficulty === 'easy' ? 8 : difficulty === 'normal' ? 10 : 12;
    const boundedStep = stepIndex % totalSteps;

    // Difficulty variants:
    // Easy: sequential counting 1, 2, 3...
    // Normal: skip counting by 2s or 5s, or simple +1/+2
    // Hard: basic equation target, e.g. "Target: 5" with choices "2+3" vs "1+3"
    if (difficulty === 'easy') {
      const targetNum = boundedStep + 1;
      const isTopCorrect = seed > 0.5;
      
      // Chance for "choice vs nothing"
      // If nothing is correct, the non-empty option is a distractor, and empty is correct!
      const isChoiceVsNothing = (boundedStep % 3 === 2);
      
      if (isChoiceVsNothing) {
        // Decide if empty or the filled one is correct
        const emptyIsCorrect = (seed * 10) % 2 < 1;
        if (emptyIsCorrect) {
          // One is distractor, other is empty (correct)
          const distractor = targetNum + (seed > 0.5 ? 2 : 3);
          const distractorOption: GateOption = { text: String(distractor), isCorrect: false };
          const emptyOption: GateOption = { text: '☁️ Clear Sky', isCorrect: true, isEmpty: true };
          return {
            prompt: `Fly Through ${targetNum} (Avoid wrong!)`,
            subPrompt: `Target is ${targetNum} — clear sky avoids wrong!`,
            mode: 'numbers',
            topOption: isTopCorrect ? distractorOption : emptyOption,
            bottomOption: isTopCorrect ? emptyOption : distractorOption,
            stepIndex: boundedStep,
            totalSteps
          };
        }
      }

      const distractor = targetNum + (seed > 0.5 ? 1 : 2) + Math.floor((seed * 3) % 2);
      const correctOption: GateOption = { text: String(targetNum), isCorrect: true };
      const distractorOption: GateOption = { text: String(distractor), isCorrect: false };

      return {
        prompt: `Fly to: ${targetNum}`,
        subPrompt: `Counting in order: step ${targetNum} of ${totalSteps}`,
        mode: 'numbers',
        topOption: isTopCorrect ? correctOption : distractorOption,
        bottomOption: isTopCorrect ? distractorOption : correctOption,
        stepIndex: boundedStep,
        totalSteps
      };
    } else if (difficulty === 'normal') {
      // Skip counting by 2s: 2, 4, 6, 8, 10...
      const stepValue = (boundedStep + 1) * 2;
      const isTopCorrect = seed > 0.5;
      const distractor = stepValue + (seed > 0.5 ? 1 : -1);

      // 30% chance for choice vs empty
      const isChoiceVsNothing = boundedStep % 4 === 3;
      if (isChoiceVsNothing) {
        const emptyIsCorrect = seed > 0.5;
        const filledOption: GateOption = {
          text: emptyIsCorrect ? String(distractor) : String(stepValue),
          isCorrect: !emptyIsCorrect
        };
        const emptyOption: GateOption = { text: '☁️ Clear Sky', isCorrect: emptyIsCorrect, isEmpty: true };
        return {
          prompt: `Count by 2s: ${stepValue}`,
          subPrompt: emptyIsCorrect ? `Neither matches? Fly through clear sky!` : `Aim for the target!`,
          mode: 'numbers',
          topOption: isTopCorrect ? filledOption : emptyOption,
          bottomOption: isTopCorrect ? emptyOption : filledOption,
          stepIndex: boundedStep,
          totalSteps
        };
      }

      const correctOption: GateOption = { text: String(stepValue), isCorrect: true };
      const distractorOption: GateOption = { text: String(distractor), isCorrect: false };

      return {
        prompt: `Count by 2s: ${stepValue}`,
        subPrompt: `Next in sequence: ${stepValue}`,
        mode: 'numbers',
        topOption: isTopCorrect ? correctOption : distractorOption,
        bottomOption: isTopCorrect ? distractorOption : correctOption,
        stepIndex: boundedStep,
        totalSteps
      };
    } else {
      // Hard: Equation balance, e.g. "Sum: 6" -> "4 + 2" vs "3 + 4"
      const targetSum = boundedStep + 4;
      const part1 = Math.floor(targetSum / 2);
      const part2 = targetSum - part1;
      const correctExpr = `${part1}+${part2}`;
      const wrongExpr = `${part1}+${part2 + 1}`;
      const isTopCorrect = seed > 0.5;

      const correctOption: GateOption = { text: correctExpr, isCorrect: true };
      const distractorOption: GateOption = { text: wrongExpr, isCorrect: false };

      return {
        prompt: `Target Sum: ${targetSum}`,
        subPrompt: `Which equals ${targetSum}?`,
        mode: 'numbers',
        topOption: isTopCorrect ? correctOption : distractorOption,
        bottomOption: isTopCorrect ? distractorOption : correctOption,
        stepIndex: boundedStep,
        totalSteps
      };
    }
  }

  private static generateSpellingQuestion(
    _difficulty: PawanaDifficulty,
    stepIndex: number,
    seed: number
  ): GateQuestion {
    // Map stepIndex dynamically across cumulative word lengths so word boundaries never desynchronize
    const totalChars = SPELLING_WORDS.reduce((sum, w) => sum + w.word.length, 0);
    const normalizedStep = stepIndex % totalChars;
    let accumulated = 0;
    let wordObj = SPELLING_WORDS[0];
    let charIndex = 0;
    for (const item of SPELLING_WORDS) {
      if (normalizedStep < accumulated + item.word.length) {
        wordObj = item;
        charIndex = normalizedStep - accumulated;
        break;
      }
      accumulated += item.word.length;
    }
    const word = wordObj.word;
    const targetChar = word[charIndex];
    const isTopCorrect = seed > 0.5;

    // Distractor letter
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let distractorChar = alphabet[Math.floor((seed * 26) % 26)];
    if (distractorChar === targetChar) {
      distractorChar = targetChar === 'Z' ? 'A' : String.fromCharCode(targetChar.charCodeAt(0) + 1);
    }

    // Spelled so far with current highlighted
    const spelled = word.split('').map((c, i) => {
      if (i < charIndex) return `[${c}]`;
      if (i === charIndex) return `__`;
      return `_`;
    }).join(' ');

    // 25% chance of choice vs empty
    const isChoiceVsNothing = charIndex === word.length - 1 && seed > 0.5;
    if (isChoiceVsNothing) {
      const emptyIsCorrect = seed > 0.75;
      const filledOption: GateOption = {
        text: emptyIsCorrect ? distractorChar : targetChar,
        isCorrect: !emptyIsCorrect
      };
      const emptyOption: GateOption = { text: '☁️ Clear Sky', isCorrect: emptyIsCorrect, isEmpty: true };
      return {
        prompt: `Spell ${word}: Next letter '${targetChar}'`,
        subPrompt: `${wordObj.clue} (${spelled})`,
        mode: 'spelling',
        topOption: isTopCorrect ? filledOption : emptyOption,
        bottomOption: isTopCorrect ? emptyOption : filledOption,
        stepIndex: charIndex,
        totalSteps: word.length
      };
    }

    const correctOption: GateOption = { text: targetChar, isCorrect: true };
    const distractorOption: GateOption = { text: distractorChar, isCorrect: false };

    return {
      prompt: `Spell ${word}: Letter '${targetChar}'`,
      subPrompt: `${wordObj.clue} (${spelled})`,
      mode: 'spelling',
      topOption: isTopCorrect ? correctOption : distractorOption,
      bottomOption: isTopCorrect ? distractorOption : correctOption,
      stepIndex: charIndex,
      totalSteps: word.length
    };
  }

  private static generateShapesQuestion(
    _difficulty: PawanaDifficulty,
    stepIndex: number,
    seed: number
  ): GateQuestion {
    const patternIndex = Math.floor((stepIndex / 6) % SHAPE_PATTERNS.length);
    const pattern = SHAPE_PATTERNS[patternIndex];
    const totalSteps = pattern.sequence.length;
    const boundedIndex = stepIndex % totalSteps;
    const targetItem = pattern.sequence[boundedIndex];

    // Pick a distractor with different shape or color
    const shapes: Array<'circle' | 'square' | 'triangle' | 'star'> = ['circle', 'square', 'triangle', 'star'];
    const otherShapes = shapes.filter(s => s !== targetItem.shape);
    const distractorShape = otherShapes[Math.floor((seed * 10) % otherShapes.length)];
    const distractorColor = targetItem.color === '#F1C40F' ? '#E74C3C' : '#F1C40F';

    const isTopCorrect = seed > 0.5;
    const correctOption: GateOption = {
      text: targetItem.label,
      shape: targetItem.shape,
      color: targetItem.color,
      isCorrect: true
    };
    const distractorOption: GateOption = {
      text: distractorShape.charAt(0).toUpperCase() + distractorShape.slice(1),
      shape: distractorShape,
      color: distractorColor,
      isCorrect: false
    };

    return {
      prompt: `Pattern: ${pattern.name}`,
      subPrompt: `Next in pattern: ${targetItem.label}`,
      mode: 'shapes',
      topOption: isTopCorrect ? correctOption : distractorOption,
      bottomOption: isTopCorrect ? distractorOption : correctOption,
      stepIndex: boundedIndex,
      totalSteps
    };
  }
}
