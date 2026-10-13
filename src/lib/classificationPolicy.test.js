import { describe, expect, it } from 'vitest';
import {
  createRuleFallbackClassifications,
  normalizeCategory,
  publishableCategory,
  ruleBasedClassify,
} from './classificationPolicy';

describe('classification uncertainty policy', () => {
  it('preserves Unknown as Unclassified instead of inventing a known category', () => {
    expect(normalizeCategory('Unknown')).toBe('Unclassified');
    expect(normalizeCategory('Unclassified')).toBe('Unclassified');
  });

  it('abstains when no rule has evidence', () => {
    expect(ruleBasedClassify({ name: 'opaque_7f91c2', domain: 'example.com' })).toBe('Unclassified');
  });

  it('creates deterministic, explicitly sourced fallback results', () => {
    const cookies = [
      { name: '_ga', domain: 'example.com' },
      { name: 'opaque_7f91c2', domain: 'example.com' },
    ];

    const first = createRuleFallbackClassifications(cookies, 'model_unavailable');
    const second = createRuleFallbackClassifications(cookies, 'model_unavailable');

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      predicted_category: 'Analytics',
      confidence_score: 0,
      source: 'rules_fallback',
      classification_status: 'suggested',
    });
    expect(first[1]).toMatchObject({
      predicted_category: 'Unclassified',
      confidence_score: 0,
      source: 'rules_fallback',
      classification_status: 'abstained',
      abstain_reason: 'model_unavailable',
    });
  });
});

describe('publishableCategory', () => {
  it('publishes a human decision (classified user_override)', () => {
    expect(publishableCategory({
      classification_status: 'classified', source: 'user_override', predicted_category: 'Marketing',
    })).toBe('Marketing');
  });

  it('keeps a model-only suggestion Unclassified', () => {
    expect(publishableCategory({
      classification_status: 'suggested', source: 'ml_prediction', predicted_category: 'Analytics',
    })).toBe('Unclassified');
  });

  it('keeps abstentions and missing results Unclassified', () => {
    expect(publishableCategory({ classification_status: 'abstained', predicted_category: 'Functional' }))
      .toBe('Unclassified');
    expect(publishableCategory(undefined)).toBe('Unclassified');
  });
});
