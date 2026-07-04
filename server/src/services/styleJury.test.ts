import { extractJson } from './llmClient';
import {
  aggregateScores,
  buildOutfitDescription,
  clampScore,
  heuristicJury,
  JuryItem,
  PERSONAS,
  templateVerdict,
} from './styleJuryService';

function juryItem(overrides: Partial<JuryItem> & { id: string }): JuryItem {
  return {
    category: 'TOP',
    colors: [],
    primaryColor: null,
    seasons: [],
    lastWornDate: null,
    isFavorite: false,
    name: null,
    subcategory: null,
    pattern: null,
    imageUrl: null,
    ...overrides,
  };
}

const OUTFIT: JuryItem[] = [
  juryItem({ id: 'a', name: 'Red tee', primaryColor: 'red', colors: ['red'] }),
  juryItem({
    id: 'b',
    name: 'Navy trousers',
    category: 'BOTTOM',
    primaryColor: 'navy',
    colors: ['navy'],
  }),
];

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson<{ score: number }>('{"score": 82}')).toEqual({ score: 82 });
  });

  it('parses JSON wrapped in prose and code fences', () => {
    const wrapped = 'Sure! Here is my rating:\n```json\n{"score": 71, "comment": "nice"}\n```\nHope that helps.';
    expect(extractJson<{ score: number }>(wrapped).score).toBe(71);
  });

  it('handles braces inside strings', () => {
    const tricky = '{"comment": "love the {vibe}", "score": 90} trailing';
    expect(extractJson<{ comment: string }>(tricky).comment).toBe('love the {vibe}');
  });

  it('throws on garbage', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('clampScore / aggregateScores', () => {
  it('clamps to 0-100 and rounds', () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore('not a number', 55)).toBe(55);
  });

  it('aggregates the panel mean', () => {
    const personas = [70, 80, 90].map((score, i) => ({
      name: `p${i}`,
      emoji: '🙂',
      role: 'r',
      score,
      comment: '',
    }));
    expect(aggregateScores(personas)).toBe(80);
    expect(aggregateScores([])).toBe(50);
  });
});

describe('buildOutfitDescription', () => {
  it('lists items with colors and context', () => {
    const text = buildOutfitDescription(OUTFIT, {
      weather: { tempC: 9.6, condition: 'rain' },
      occasion: 'first date',
    });
    expect(text).toContain('Red tee');
    expect(text).toContain('color: navy');
    expect(text).toContain('Weather: 10°C, rain');
    expect(text).toContain('Occasion: first date');
  });
});

describe('heuristicJury', () => {
  it('returns a full deterministic panel', () => {
    const a = heuristicJury(OUTFIT, {});
    const b = heuristicJury(OUTFIT, {});
    expect(a.personas).toHaveLength(PERSONAS.length);
    expect(a.source).toBe('HEURISTIC');
    expect(a).toEqual(b); // deterministic for the same outfit
    expect(a.overallScore).toBeGreaterThanOrEqual(0);
    expect(a.overallScore).toBeLessThanOrEqual(100);
    for (const p of a.personas) {
      expect(p.comment.length).toBeGreaterThan(4);
    }
  });

  it('gives distinct persona voices (comments differ)', () => {
    const { personas } = heuristicJury(OUTFIT, {});
    expect(new Set(personas.map((p) => p.comment)).size).toBeGreaterThan(4);
  });

  it('learned liked color pairs raise the score', () => {
    const neutral = heuristicJury(OUTFIT, {});
    const liked = heuristicJury(OUTFIT, {}, new Map([['navy|red', 1]]));
    const disliked = heuristicJury(OUTFIT, {}, new Map([['navy|red', -1]]));
    expect(liked.overallScore).toBeGreaterThan(neutral.overallScore);
    expect(disliked.overallScore).toBeLessThan(neutral.overallScore);
  });

  it('grandma worries about cold weather without outerwear', () => {
    const cold = heuristicJury(OUTFIT, { weather: { tempC: 2, condition: 'snow' } });
    const ruth = cold.personas.find((p) => p.name === 'Nana Ruth')!;
    expect(ruth.comment.toLowerCase()).toContain('warm enough');
  });

  it('verdict tracks the score band', () => {
    expect(templateVerdict(90)).toContain('impressed');
    expect(templateVerdict(40)).toContain('skeptical');
  });
});
