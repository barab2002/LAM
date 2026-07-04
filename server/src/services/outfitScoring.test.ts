import {
  colorPairKey,
  generateCombos,
  itemSuitsWeather,
  outfitColorPairs,
  outfitSignature,
  ScorableItem,
  scoreBodyShapeFit,
  scoreColorHarmony,
  scoreFreshness,
  scoreOutfit,
  seasonsForTemperature,
} from './outfitScoring';
import { nextWeight } from './preferenceService';

function item(overrides: Partial<ScorableItem> & { id: string }): ScorableItem {
  return {
    category: 'TOP',
    colors: [],
    primaryColor: null,
    seasons: [],
    lastWornDate: null,
    isFavorite: false,
    ...overrides,
  };
}

describe('colorPairKey', () => {
  it('is order-insensitive and lowercase', () => {
    expect(colorPairKey('White', 'blue')).toBe('blue|white');
    expect(colorPairKey('blue', 'white')).toBe('blue|white');
  });
});

describe('outfitColorPairs', () => {
  it('builds unique pairs from primary colors', () => {
    const items = [
      item({ id: '1', primaryColor: 'blue' }),
      item({ id: '2', primaryColor: 'white', category: 'BOTTOM' }),
      item({ id: '3', primaryColor: 'blue', category: 'SHOES' }),
    ];
    expect(outfitColorPairs(items).sort()).toEqual(['blue|white']);
  });
});

describe('scoreColorHarmony', () => {
  it('prefers learned liked pairs over unknown pairs', () => {
    const outfit = [
      item({ id: '1', primaryColor: 'red' }),
      item({ id: '2', primaryColor: 'green', category: 'BOTTOM' }),
    ];
    const liked = scoreColorHarmony(outfit, new Map([['green|red', 0.8]]));
    const unknown = scoreColorHarmony(outfit, new Map());
    expect(liked.score).toBeGreaterThan(unknown.score);
  });

  it('penalizes learned disliked pairs', () => {
    const outfit = [
      item({ id: '1', primaryColor: 'red' }),
      item({ id: '2', primaryColor: 'green', category: 'BOTTOM' }),
    ];
    const disliked = scoreColorHarmony(outfit, new Map([['green|red', -0.9]]));
    expect(disliked.score).toBeLessThan(0);
  });

  it('treats neutrals as safe partners', () => {
    const outfit = [
      item({ id: '1', primaryColor: 'black' }),
      item({ id: '2', primaryColor: 'orange', category: 'BOTTOM' }),
    ];
    expect(scoreColorHarmony(outfit, new Map()).score).toBeGreaterThan(0);
  });

  it('rewards monochrome outfits', () => {
    const outfit = [
      item({ id: '1', primaryColor: 'navy' }),
      item({ id: '2', primaryColor: 'navy', category: 'BOTTOM' }),
    ];
    const { score, reasons } = scoreColorHarmony(outfit, new Map());
    expect(score).toBeGreaterThan(0);
    expect(reasons).toContain('Monochrome look');
  });
});

describe('scoreBodyShapeFit', () => {
  const brightTop = item({ id: 't', category: 'TOP', primaryColor: 'yellow' });
  const darkBottom = item({ id: 'b', category: 'BOTTOM', primaryColor: 'black' });

  it('rewards bright top + dark bottom for PEAR', () => {
    const fit = scoreBodyShapeFit([brightTop, darkBottom], 'PEAR');
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.reasons.length).toBeGreaterThan(0);
  });

  it('is neutral without a body shape', () => {
    expect(scoreBodyShapeFit([brightTop, darkBottom], null).score).toBe(0);
  });

  it('rewards dresses for HOURGLASS', () => {
    const dress = item({ id: 'd', category: 'DRESS', primaryColor: 'red' });
    expect(scoreBodyShapeFit([dress], 'HOURGLASS').score).toBeGreaterThan(0);
  });
});

describe('weather filtering', () => {
  it('maps temperature to seasons', () => {
    expect(seasonsForTemperature(30)).toEqual(['SUMMER']);
    expect(seasonsForTemperature(18)).toEqual(['SPRING', 'SUMMER']);
    expect(seasonsForTemperature(10)).toEqual(['SPRING', 'FALL']);
    expect(seasonsForTemperature(-2)).toEqual(['WINTER', 'FALL']);
  });

  it('keeps untagged items and filters off-season ones', () => {
    const winterCoat = item({ id: 'w', seasons: ['WINTER'] });
    const untagged = item({ id: 'u' });
    const hot = { tempC: 28, condition: 'clear' };
    expect(itemSuitsWeather(winterCoat, hot)).toBe(false);
    expect(itemSuitsWeather(untagged, hot)).toBe(true);
  });
});

describe('scoreFreshness', () => {
  const now = new Date('2026-07-04T00:00:00Z');

  it('penalizes recently worn items', () => {
    const wornYesterday = [
      item({ id: '1', lastWornDate: new Date('2026-07-03T00:00:00Z') }),
    ];
    const wornLongAgo = [
      item({ id: '2', lastWornDate: new Date('2026-01-01T00:00:00Z') }),
    ];
    expect(scoreFreshness(wornYesterday, now).score).toBeLessThan(
      scoreFreshness(wornLongAgo, now).score,
    );
  });

  it('boosts never-worn items and favorites', () => {
    const fresh = [item({ id: '1', isFavorite: true })];
    expect(scoreFreshness(fresh, now).score).toBeGreaterThan(0);
  });
});

describe('generateCombos', () => {
  const top = item({ id: 't1', category: 'TOP' });
  const bottom = item({ id: 'b1', category: 'BOTTOM' });
  const dress = item({ id: 'd1', category: 'DRESS' });
  const coat = item({ id: 'o1', category: 'OUTERWEAR' });
  const shoes = item({ id: 's1', category: 'SHOES' });

  it('builds top+bottom and dress bases with shoes', () => {
    const combos = generateCombos([top, bottom, dress, shoes], {
      requireOuterwear: false,
      allowOuterwear: false,
    });
    const signatures = combos.map((c) => outfitSignature(c.map((i) => i.id)));
    expect(signatures).toContain('b1,s1,t1');
    expect(signatures).toContain('d1,s1');
  });

  it('requires outerwear in cold weather', () => {
    const combos = generateCombos([top, bottom, coat, shoes], {
      requireOuterwear: true,
      allowOuterwear: true,
    });
    expect(combos.length).toBeGreaterThan(0);
    for (const combo of combos) {
      expect(combo.some((i) => i.category === 'OUTERWEAR')).toBe(true);
    }
  });

  it('drops all combos when outerwear is required but missing', () => {
    const combos = generateCombos([top, bottom, shoes], {
      requireOuterwear: true,
      allowOuterwear: true,
    });
    expect(combos).toHaveLength(0);
  });

  it('caps the number of combos', () => {
    const many: ScorableItem[] = [];
    for (let i = 0; i < 30; i++) {
      many.push(item({ id: `t${i}`, category: 'TOP' }));
      many.push(item({ id: `b${i}`, category: 'BOTTOM' }));
    }
    const combos = generateCombos(many, {
      requireOuterwear: false,
      allowOuterwear: false,
      maxCombos: 100,
    });
    expect(combos.length).toBeLessThanOrEqual(100);
  });
});

describe('scoreOutfit', () => {
  const ctx = {
    learnedWeights: new Map<string, number>(),
    bodyShape: null,
    now: new Date('2026-07-04T00:00:00Z'),
    recentSignatures: new Set<string>(),
  };

  it('hard-excludes recently worn outfits', () => {
    const outfit = [
      item({ id: 'a', primaryColor: 'white' }),
      item({ id: 'b', primaryColor: 'blue', category: 'BOTTOM' }),
    ];
    const worn = { ...ctx, recentSignatures: new Set([outfitSignature(['a', 'b'])]) };
    expect(scoreOutfit(outfit, worn)).toBeNull();
    expect(scoreOutfit(outfit, ctx)).not.toBeNull();
  });
});

describe('preference learning (nextWeight)', () => {
  it('moves toward +1 on likes and -1 on dislikes, clamped', () => {
    expect(nextWeight(0, true)).toBeCloseTo(0.2);
    expect(nextWeight(0, false)).toBeCloseTo(-0.2);
    expect(nextWeight(0.95, true)).toBe(1);
    expect(nextWeight(-0.95, false)).toBe(-1);
  });
});
