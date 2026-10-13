export const UNCLASSIFIED_CATEGORY = 'Unclassified';

export function normalizeCategory(category) {
  const mapping = {
    Analytics_Performance: 'Analytics',
    Marketing_Advertising: 'Marketing',
    Strictly_Necessary: 'Strictly Necessary',
    Functional: 'Functional',
    Unclassified: UNCLASSIFIED_CATEGORY,
    Unknown: UNCLASSIFIED_CATEGORY,
    Uncategorized: UNCLASSIFIED_CATEGORY,
  };
  return mapping[category] || category || UNCLASSIFIED_CATEGORY;
}

/**
 * The category that ships in the consent banner. Only a `classified` result
 * publishes: a reviewed human decision, or a promoted model's auto-classification.
 * Model suggestions and abstentions stay Unclassified until someone decides.
 */
export function publishableCategory(mlData) {
  return mlData?.classification_status === 'classified'
    ? normalizeCategory(mlData.predicted_category)
    : UNCLASSIFIED_CATEGORY;
}

export function ruleBasedClassify(cookie) {
  const name = (cookie.name || '').toLowerCase();
  const domain = (cookie.domain || '').toLowerCase();

  if (name.startsWith('_ga') || name === '_gid' || name === '_gat' ||
      name.includes('analytics') || name.includes('_utm') || name.includes('stat')) {
    return 'Analytics';
  }
  if (name.includes('_fb') || name.includes('fbp') || name.includes('fbc') ||
      name.includes('ads') || name.includes('marketing') || name.includes('track') ||
      name.includes('campaign') || name.includes('utm_') || name.startsWith('__gads')) {
    return 'Marketing';
  }
  if (name.includes('session') || name.includes('csrf') || name.includes('xsrf') ||
      name.includes('auth') || name.includes('token') || name.includes('login') ||
      name.includes('secure') || name.includes('captcha')) {
    return 'Strictly Necessary';
  }
  if (name.includes('pref') || name.includes('lang') || name.includes('locale') ||
      name.includes('theme') || name.includes('timezone') || name.includes('currency')) {
    return 'Functional';
  }
  if (domain.includes('google') || domain.includes('doubleclick') || domain.includes('googlesyndication')) {
    return name.includes('consent') || name.includes('nid') ? 'Functional' : 'Analytics';
  }
  if (domain.includes('facebook') || domain.includes('fb.com') || domain.includes('linkedin')) {
    return 'Marketing';
  }
  return UNCLASSIFIED_CATEGORY;
}

export function createRuleFallbackClassifications(cookies, reason = 'model_unavailable') {
  return cookies.map((cookie) => {
    const predictedCategory = ruleBasedClassify(cookie);
    const abstained = predictedCategory === UNCLASSIFIED_CATEGORY;
    return {
      cookie_id: `${cookie.name}-${cookie.domain}`,
      predicted_category: predictedCategory,
      confidence_score: 0,
      confidence_level: 'Low',
      auto_classified: false,
      requires_review: true,
      alternative_predictions: [],
      source: 'rules_fallback',
      classification_status: abstained ? 'abstained' : 'suggested',
      abstain_reason: abstained ? reason : null,
    };
  });
}
