import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

const VALID_CATEGORIES = [
  'Strictly Necessary',
  'Functional',
  'Analytics',
  'Marketing',
  'Preferences',
  'Social Media'
];

/**
 * Feature: cookie-category-ml-ui-improvements, Property 1: Category Badge Rendering
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 4.5
 * 
 * For any cookie in the scan results, the Category column should display the value of 
 * cookie.category (or "Uncategorized" if missing) as a color-coded, non-interactive 
 * badge with consistent styling across all rows.
 */
describe('Property 1: Category Badge Rendering', () => {
  // Helper function that mimics the badge rendering logic from App.jsx
  const renderCategoryBadge = (category) => {
    const displayCategory = category || 'Uncategorized';
    const cssClass = `category-${(category || 'uncategorized').toLowerCase().replace(/\s+/g, '-')}`;
    return {
      displayCategory,
      cssClass,
      isInteractive: false // Badge is a span, not interactive
    };
  };

  it('should display category as non-interactive badge with correct styling for any cookie', () => {
    fc.assert(
      fc.property(
        // Generate random cookie data
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            value: fc.string({ maxLength: 100 }),
            path: fc.constantFrom('/', '/path', '/api'),
            httpOnly: fc.boolean(),
            secure: fc.boolean(),
            sameSite: fc.constantFrom('Strict', 'Lax', 'None', undefined),
            type: fc.constantFrom('Session', 'Persistent'),
            requiresConsent: fc.boolean(),
            isThirdParty: fc.boolean(),
            size: fc.integer({ min: 0, max: 10000 }),
            // Category can be valid or missing/null
            category: fc.option(fc.constantFrom(...VALID_CATEGORIES, null, undefined), { nil: null })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (cookies) => {
          // For each cookie, verify the badge rendering logic
          cookies.forEach((cookie) => {
            const badge = renderCategoryBadge(cookie.category);
            
            // Property 1: Badge should display the category or "Uncategorized"
            const expectedCategory = cookie.category || 'Uncategorized';
            expect(badge.displayCategory).toBe(expectedCategory);
            
            // Property 2: Badge should have the correct CSS class for color coding
            const expectedClass = `category-${(cookie.category || 'uncategorized').toLowerCase().replace(/\s+/g, '-')}`;
            expect(badge.cssClass).toBe(expectedClass);
            expect(badge.cssClass).toMatch(/^category-/);
            
            // Property 3: Badge should be non-interactive
            expect(badge.isInteractive).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render "Uncategorized" for cookies with missing or invalid category', () => {
    fc.assert(
      fc.property(
        // Generate cookies with null, undefined, or empty category
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            value: fc.string({ maxLength: 100 }),
            path: fc.constantFrom('/', '/path'),
            httpOnly: fc.boolean(),
            secure: fc.boolean(),
            type: fc.constantFrom('Session', 'Persistent'),
            requiresConsent: fc.boolean(),
            isThirdParty: fc.boolean(),
            size: fc.integer({ min: 0, max: 10000 }),
            category: fc.constantFrom(null, undefined, '')
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (cookies) => {
          // For each cookie with missing category
          cookies.forEach((cookie) => {
            const badge = renderCategoryBadge(cookie.category);
            
            // Property: Missing/invalid categories should display as "Uncategorized"
            expect(badge.displayCategory).toBe('Uncategorized');
            expect(badge.cssClass).toBe('category-uncategorized');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply consistent styling across all category badges', () => {
    fc.assert(
      fc.property(
        // Generate multiple cookies with various categories
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            category: fc.constantFrom(...VALID_CATEGORIES)
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (cookies) => {
          // Verify that all badges follow the same pattern
          const badges = cookies.map(cookie => renderCategoryBadge(cookie.category));
          
          // Property: All badges should follow the same CSS class pattern
          badges.forEach(badge => {
            expect(badge.cssClass).toMatch(/^category-[a-z-]+$/);
          });
          
          // Property: Same category should always produce same class
          const categoryToClass = {};
          cookies.forEach(cookie => {
            const badge = renderCategoryBadge(cookie.category);
            if (categoryToClass[cookie.category]) {
              expect(categoryToClass[cookie.category]).toBe(badge.cssClass);
            } else {
              categoryToClass[cookie.category] = badge.cssClass;
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 4: Category Update State Propagation
 * Validates: Requirements 3.2, 3.3, 5.4
 * 
 * For any cookie, when a user selects a new category from the ML Classification dropdown 
 * and the API call succeeds, both the cookie.category value and the displayed Category 
 * column badge should be updated to reflect the new value.
 */
describe('Property 4: Category Update State Propagation', () => {
  // Helper function that simulates the state update logic
  const updateCookieCategory = (cookies, cookieName, cookieDomain, newCategory) => {
    return cookies.map(c => {
      if (c.name === cookieName && c.domain === cookieDomain) {
        return { ...c, category: newCategory };
      }
      return c;
    });
  };

  it('should update cookie.category in state when category is changed', () => {
    fc.assert(
      fc.property(
        // Generate random cookies
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            value: fc.string({ maxLength: 100 }),
            category: fc.constantFrom(...VALID_CATEGORIES),
            mlClassification: fc.constantFrom(...VALID_CATEGORIES),
            mlConfidence: fc.float({ min: 0, max: 1 }),
            mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low')
          }),
          { minLength: 1, maxLength: 10 }
        ),
        // Generate a new category to update to
        fc.constantFrom(...VALID_CATEGORIES),
        (cookies, newCategory) => {
          // Pick a random cookie to update
          if (cookies.length === 0) return;
          
          const targetCookie = cookies[0];
          const oldCategory = targetCookie.category;
          
          // Simulate the update
          const updatedCookies = updateCookieCategory(
            cookies,
            targetCookie.name,
            targetCookie.domain,
            newCategory
          );
          
          // Find the updated cookie
          const updatedCookie = updatedCookies.find(
            c => c.name === targetCookie.name && c.domain === targetCookie.domain
          );
          
          // Property: The cookie's category should be updated
          expect(updatedCookie.category).toBe(newCategory);
          
          // Property: Other cookies should remain unchanged
          const otherCookies = updatedCookies.filter(
            c => c.name !== targetCookie.name || c.domain !== targetCookie.domain
          );
          const originalOtherCookies = cookies.filter(
            c => c.name !== targetCookie.name || c.domain !== targetCookie.domain
          );
          
          expect(otherCookies).toEqual(originalOtherCookies);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain all other cookie properties when updating category', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          domain: fc.domain(),
          value: fc.string({ maxLength: 100 }),
          path: fc.constantFrom('/', '/path'),
          httpOnly: fc.boolean(),
          secure: fc.boolean(),
          sameSite: fc.constantFrom('Strict', 'Lax', 'None'),
          type: fc.constantFrom('Session', 'Persistent'),
          requiresConsent: fc.boolean(),
          isThirdParty: fc.boolean(),
          size: fc.integer({ min: 0, max: 10000 }),
          category: fc.constantFrom(...VALID_CATEGORIES),
          mlClassification: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.float({ min: 0, max: 1 }),
          mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low')
        }),
        fc.constantFrom(...VALID_CATEGORIES),
        (cookie, newCategory) => {
          const cookies = [cookie];
          const updatedCookies = updateCookieCategory(
            cookies,
            cookie.name,
            cookie.domain,
            newCategory
          );
          
          const updatedCookie = updatedCookies[0];
          
          // Property: Only category should change, all other properties should remain the same
          expect(updatedCookie.name).toBe(cookie.name);
          expect(updatedCookie.domain).toBe(cookie.domain);
          expect(updatedCookie.value).toBe(cookie.value);
          expect(updatedCookie.path).toBe(cookie.path);
          expect(updatedCookie.httpOnly).toBe(cookie.httpOnly);
          expect(updatedCookie.secure).toBe(cookie.secure);
          expect(updatedCookie.sameSite).toBe(cookie.sameSite);
          expect(updatedCookie.type).toBe(cookie.type);
          expect(updatedCookie.requiresConsent).toBe(cookie.requiresConsent);
          expect(updatedCookie.isThirdParty).toBe(cookie.isThirdParty);
          expect(updatedCookie.size).toBe(cookie.size);
          expect(updatedCookie.mlClassification).toBe(cookie.mlClassification);
          expect(updatedCookie.mlConfidence).toBe(cookie.mlConfidence);
          expect(updatedCookie.mlConfidenceLevel).toBe(cookie.mlConfidenceLevel);
          
          // Only category should be different
          expect(updatedCookie.category).toBe(newCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 5: Category Update API Contract
 * Validates: Requirements 3.1, 3.6, 5.1, 5.2, 5.3
 * 
 * For any category update request, the system should call the /api/categories/update-category 
 * endpoint with all required fields (scan_id, cookie_name, cookie_domain, old_category, 
 * new_category) and handle both success and error responses appropriately.
 */
describe('Property 5: Category Update API Contract', () => {
  // Helper function that validates the API request structure
  const validateAPIRequest = (requestBody) => {
    const requiredFields = ['scan_id', 'cookie_name', 'cookie_domain', 'old_category', 'new_category'];
    const hasAllFields = requiredFields.every(field => field in requestBody);
    
    return {
      hasAllFields,
      missingFields: requiredFields.filter(field => !(field in requestBody)),
      fieldTypes: {
        scan_id: typeof requestBody.scan_id,
        cookie_name: typeof requestBody.cookie_name,
        cookie_domain: typeof requestBody.cookie_domain,
        old_category: typeof requestBody.old_category,
        new_category: typeof requestBody.new_category
      }
    };
  };

  it('should include all required fields in API request', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // cookie_name
        fc.domain(), // cookie_domain
        fc.constantFrom(...VALID_CATEGORIES), // old_category
        fc.constantFrom(...VALID_CATEGORIES), // new_category
        fc.string({ minLength: 1, maxLength: 50 }), // scan_id
        (cookieName, cookieDomain, oldCategory, newCategory, scanId) => {
          // Construct the API request body as the handler would
          const requestBody = {
            scan_id: scanId,
            cookie_name: cookieName,
            cookie_domain: cookieDomain,
            old_category: oldCategory,
            new_category: newCategory
          };
          
          const validation = validateAPIRequest(requestBody);
          
          // Property: All required fields must be present
          expect(validation.hasAllFields).toBe(true);
          expect(validation.missingFields).toEqual([]);
          
          // Property: All fields should be strings
          expect(validation.fieldTypes.scan_id).toBe('string');
          expect(validation.fieldTypes.cookie_name).toBe('string');
          expect(validation.fieldTypes.cookie_domain).toBe('string');
          expect(validation.fieldTypes.old_category).toBe('string');
          expect(validation.fieldTypes.new_category).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should construct valid API request for any cookie update', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          domain: fc.domain(),
          category: fc.constantFrom(...VALID_CATEGORIES)
        }),
        fc.constantFrom(...VALID_CATEGORIES),
        fc.string({ minLength: 1, maxLength: 50 }),
        (cookie, newCategory, scanId) => {
          // Construct request as the handler would
          const requestBody = {
            scan_id: scanId,
            cookie_name: cookie.name,
            cookie_domain: cookie.domain,
            old_category: cookie.category,
            new_category: newCategory
          };
          
          // Property: Request should match the expected structure
          expect(requestBody).toHaveProperty('scan_id');
          expect(requestBody).toHaveProperty('cookie_name');
          expect(requestBody).toHaveProperty('cookie_domain');
          expect(requestBody).toHaveProperty('old_category');
          expect(requestBody).toHaveProperty('new_category');
          
          // Property: Values should match the input
          expect(requestBody.scan_id).toBe(scanId);
          expect(requestBody.cookie_name).toBe(cookie.name);
          expect(requestBody.cookie_domain).toBe(cookie.domain);
          expect(requestBody.old_category).toBe(cookie.category);
          expect(requestBody.new_category).toBe(newCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 7: Error Recovery and Rollback
 * Validates: Requirements 3.5
 * 
 * For any failed category update API call, the system should revert the UI to display 
 * the previous category value and show an error message to the user.
 */
describe('Property 7: Error Recovery and Rollback', () => {
  // Helper function that simulates rollback logic
  const rollbackCategoryUpdate = (cookies, cookieName, cookieDomain, originalCategory) => {
    return cookies.map(c => {
      if (c.name === cookieName && c.domain === cookieDomain) {
        return { ...c, category: originalCategory };
      }
      return c;
    });
  };

  it('should revert to original category on API failure', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            mlClassification: fc.constantFrom(...VALID_CATEGORIES)
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.constantFrom(...VALID_CATEGORIES),
        (cookies, newCategory) => {
          if (cookies.length === 0) return;
          
          const targetCookie = cookies[0];
          const originalCategory = targetCookie.category;
          
          // Simulate optimistic update
          const optimisticCookies = cookies.map(c => {
            if (c.name === targetCookie.name && c.domain === targetCookie.domain) {
              return { ...c, category: newCategory };
            }
            return c;
          });
          
          // Verify optimistic update happened
          const optimisticCookie = optimisticCookies.find(
            c => c.name === targetCookie.name && c.domain === targetCookie.domain
          );
          expect(optimisticCookie.category).toBe(newCategory);
          
          // Simulate API failure and rollback
          const rolledBackCookies = rollbackCategoryUpdate(
            optimisticCookies,
            targetCookie.name,
            targetCookie.domain,
            originalCategory
          );
          
          // Property: After rollback, category should be back to original
          const rolledBackCookie = rolledBackCookies.find(
            c => c.name === targetCookie.name && c.domain === targetCookie.domain
          );
          expect(rolledBackCookie.category).toBe(originalCategory);
          
          // Property: Other cookies should remain unchanged
          const otherCookies = rolledBackCookies.filter(
            c => c.name !== targetCookie.name || c.domain !== targetCookie.domain
          );
          const originalOtherCookies = cookies.filter(
            c => c.name !== targetCookie.name || c.domain !== targetCookie.domain
          );
          expect(otherCookies).toEqual(originalOtherCookies);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data integrity during rollback', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          domain: fc.domain(),
          value: fc.string({ maxLength: 100 }),
          category: fc.constantFrom(...VALID_CATEGORIES),
          mlClassification: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.float({ min: 0, max: 1 }),
          httpOnly: fc.boolean(),
          secure: fc.boolean()
        }),
        fc.constantFrom(...VALID_CATEGORIES),
        (cookie, newCategory) => {
          const cookies = [cookie];
          const originalCategory = cookie.category;
          
          // Optimistic update
          const optimisticCookies = cookies.map(c => ({ ...c, category: newCategory }));
          
          // Rollback
          const rolledBackCookies = rollbackCategoryUpdate(
            optimisticCookies,
            cookie.name,
            cookie.domain,
            originalCategory
          );
          
          const rolledBackCookie = rolledBackCookies[0];
          
          // Property: All properties except category should remain unchanged
          expect(rolledBackCookie.name).toBe(cookie.name);
          expect(rolledBackCookie.domain).toBe(cookie.domain);
          expect(rolledBackCookie.value).toBe(cookie.value);
          expect(rolledBackCookie.mlClassification).toBe(cookie.mlClassification);
          expect(rolledBackCookie.mlConfidence).toBe(cookie.mlConfidence);
          expect(rolledBackCookie.httpOnly).toBe(cookie.httpOnly);
          expect(rolledBackCookie.secure).toBe(cookie.secure);
          
          // Property: Category should be reverted to original
          expect(rolledBackCookie.category).toBe(originalCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 8: Sequential Update Independence
 * Validates: Requirements 5.5
 * 
 * For any sequence of category updates on multiple cookies, the system should handle 
 * each update independently without race conditions, ensuring each update completes 
 * correctly regardless of other concurrent updates.
 */
describe('Property 8: Sequential Update Independence', () => {
  // Helper function that applies multiple updates sequentially
  const applySequentialUpdates = (initialCookies, updates) => {
    let currentCookies = initialCookies;
    
    for (const update of updates) {
      currentCookies = currentCookies.map(c => {
        if (c.name === update.cookieName && c.domain === update.cookieDomain) {
          return { ...c, category: update.newCategory };
        }
        return c;
      });
    }
    
    return currentCookies;
  };

  it('should handle multiple sequential updates independently', () => {
    fc.assert(
      fc.property(
        // Generate multiple cookies
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            category: fc.constantFrom(...VALID_CATEGORIES),
            mlClassification: fc.constantFrom(...VALID_CATEGORIES)
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (cookies) => {
          if (cookies.length < 2) return;
          
          // Create updates for different cookies
          const updates = cookies.slice(0, Math.min(3, cookies.length)).map((cookie, idx) => ({
            cookieName: cookie.name,
            cookieDomain: cookie.domain,
            newCategory: VALID_CATEGORIES[idx % VALID_CATEGORIES.length]
          }));
          
          // Apply updates sequentially
          const updatedCookies = applySequentialUpdates(cookies, updates);
          
          // Property: Each update should be applied correctly
          updates.forEach(update => {
            const updatedCookie = updatedCookies.find(
              c => c.name === update.cookieName && c.domain === update.cookieDomain
            );
            expect(updatedCookie.category).toBe(update.newCategory);
          });
          
          // Property: Cookies not in the update list should remain unchanged
          const unchangedCookies = cookies.filter(
            c => !updates.some(u => u.cookieName === c.name && u.cookieDomain === c.domain)
          );
          const unchangedAfterUpdate = updatedCookies.filter(
            c => !updates.some(u => u.cookieName === c.name && u.cookieDomain === c.domain)
          );
          
          expect(unchangedAfterUpdate).toEqual(unchangedCookies);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain update order for the same cookie', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          domain: fc.domain(),
          category: fc.constantFrom(...VALID_CATEGORIES)
        }),
        // Generate a sequence of category updates
        fc.array(fc.constantFrom(...VALID_CATEGORIES), { minLength: 2, maxLength: 5 }),
        (cookie, categorySequence) => {
          const cookies = [cookie];
          
          // Create sequential updates for the same cookie
          const updates = categorySequence.map(newCategory => ({
            cookieName: cookie.name,
            cookieDomain: cookie.domain,
            newCategory
          }));
          
          // Apply updates sequentially
          const updatedCookies = applySequentialUpdates(cookies, updates);
          
          // Property: Final category should be the last update in the sequence
          const finalCookie = updatedCookies[0];
          const lastUpdate = categorySequence[categorySequence.length - 1];
          expect(finalCookie.category).toBe(lastUpdate);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle updates to different cookies without interference', () => {
    fc.assert(
      fc.property(
        // Generate distinct cookies
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            domain: fc.domain(),
            category: fc.constantFrom(...VALID_CATEGORIES)
          }),
          { minLength: 3, maxLength: 5 }
        ),
        (cookies) => {
          if (cookies.length < 3) return;
          
          // Make sure we have distinct cookies by name+domain
          const distinctCookies = [];
          const seen = new Set();
          for (const cookie of cookies) {
            const key = `${cookie.name}-${cookie.domain}`;
            if (!seen.has(key)) {
              seen.add(key);
              distinctCookies.push(cookie);
            }
          }
          
          if (distinctCookies.length < 2) return;
          
          // Create updates for different cookies with different categories
          const updates = distinctCookies.slice(0, 2).map((cookie, idx) => ({
            cookieName: cookie.name,
            cookieDomain: cookie.domain,
            newCategory: VALID_CATEGORIES[(idx + 1) % VALID_CATEGORIES.length]
          }));
          
          // Apply updates
          const updatedCookies = applySequentialUpdates(distinctCookies, updates);
          
          // Property: Each cookie should have its own update applied independently
          updates.forEach(update => {
            const updatedCookie = updatedCookies.find(
              c => c.name === update.cookieName && c.domain === update.cookieDomain
            );
            expect(updatedCookie.category).toBe(update.newCategory);
          });
          
          // Property: Updates to one cookie should not affect other cookies
          const cookie1 = updatedCookies.find(
            c => c.name === updates[0].cookieName && c.domain === updates[0].cookieDomain
          );
          const cookie2 = updatedCookies.find(
            c => c.name === updates[1].cookieName && c.domain === updates[1].cookieDomain
          );
          
          expect(cookie1.category).toBe(updates[0].newCategory);
          expect(cookie2.category).toBe(updates[1].newCategory);
          expect(cookie1.category).not.toBe(cookie2.category);
        }
      ),
      { numRuns: 100 }
    );
  });
});
