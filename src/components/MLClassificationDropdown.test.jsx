import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import MLClassificationDropdown from './MLClassificationDropdown';

const VALID_CATEGORIES = [
  'Strictly Necessary',
  'Functional',
  'Analytics',
  'Marketing',
  'Unknown'
];

/**
 * Feature: cookie-category-ml-ui-improvements, Property 2: ML Classification Dropdown Pre-selection
 * Validates: Requirements 2.1, 2.2, 2.5
 * 
 * For any cookie with ML classification data, the ML Classification dropdown should be 
 * pre-selected with the value of cookie.mlClassification and display all available 
 * cookie categories as selectable options.
 */
describe('Property 2: Stored category dropdown', () => {
  it('should show the stored category and expose all canonical choices', () => {
    fc.assert(
      fc.property(
        // Generate random ML classification data
        fc.record({
          mlClassification: fc.constantFrom(...VALID_CATEGORIES),
          actualCategory: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.double({ min: 0, max: 1 }),
          mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low'),
          cookieName: fc.string({ minLength: 1, maxLength: 50 }),
          cookieDomain: fc.domain(),
          scanId: fc.uuid()
        }),
        (testData) => {
          const mockOnCategoryUpdate = vi.fn();
          
          const { container, unmount } = render(
            <MLClassificationDropdown
              currentMLClassification={testData.mlClassification}
              actualCategory={testData.actualCategory}
              mlConfidence={testData.mlConfidence}
              mlConfidenceLevel={testData.mlConfidenceLevel}
              cookieName={testData.cookieName}
              cookieDomain={testData.cookieDomain}
              scanId={testData.scanId}
              onCategoryUpdate={mockOnCategoryUpdate}
            />
          );

          // The editable value is the stored category; ML remains a suggestion.
          const trigger = container.querySelector('.ml-dropdown-trigger');
          expect(trigger).toBeTruthy();
          expect(trigger.textContent).toContain(testData.actualCategory);

          // Property 2: When opened, all categories should be available
          fireEvent.click(trigger);
          
          const dropdownMenu = container.querySelector('.ml-dropdown-menu');
          expect(dropdownMenu).toBeTruthy();

          // Verify all categories are present
          VALID_CATEGORIES.forEach(category => {
            const expectedLabel = category === 'Unknown' ? 'Unclassified' : category;
            const categoryItem = Array.from(
              container.querySelectorAll('.ml-category-item-label')
            ).find(el => el.textContent === expectedLabel);
            expect(categoryItem).toBeTruthy();
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 3: ML Confidence Display
 * Validates: Requirements 2.6
 * 
 * For any cookie with ML confidence data, the system should display the confidence 
 * level alongside the ML Classification dropdown.
 */
describe('Property 3: ML Confidence Display', () => {
  it('should display confidence level for any cookie with ML confidence data', () => {
    fc.assert(
      fc.property(
        fc.record({
          mlClassification: fc.constantFrom(...VALID_CATEGORIES),
          actualCategory: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.double({ min: 0, max: 1 }),
          mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low'),
          cookieName: fc.string({ minLength: 1, maxLength: 50 }),
          cookieDomain: fc.domain(),
          scanId: fc.uuid()
        }),
        (testData) => {
          const mockOnCategoryUpdate = vi.fn();
          
          const { container, unmount } = render(
            <MLClassificationDropdown
              currentMLClassification={testData.mlClassification}
              actualCategory={testData.actualCategory}
              mlConfidence={testData.mlConfidence}
              mlConfidenceLevel={testData.mlConfidenceLevel}
              cookieName={testData.cookieName}
              cookieDomain={testData.cookieDomain}
              scanId={testData.scanId}
              onCategoryUpdate={mockOnCategoryUpdate}
            />
          );

          // Property: Confidence badge should be displayed with the correct level
          const confidenceBadge = container.querySelector('.ml-confidence-badge');
          expect(confidenceBadge).toBeTruthy();
          expect(confidenceBadge.textContent).toBe(testData.mlConfidenceLevel);
          
          // Verify the badge has the correct CSS class for the confidence level
          expect(confidenceBadge.classList.contains(
            `confidence-${testData.mlConfidenceLevel.toLowerCase()}`
          )).toBe(true);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cookie-category-ml-ui-improvements, Property 6: Visual Agreement Indicators
 * Validates: Requirements 4.2, 4.3
 * 
 * For any cookie, when the actual category matches the ML prediction, the system should 
 * provide visual feedback indicating agreement; when they differ, the system should 
 * provide visual feedback indicating a discrepancy.
 */
describe('Property 6: Visual Agreement Indicators', () => {
  it('should show agreement indicator when ML matches actual category', () => {
    fc.assert(
      fc.property(
        fc.record({
          category: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.double({ min: 0, max: 1 }),
          mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low'),
          cookieName: fc.string({ minLength: 1, maxLength: 50 }),
          cookieDomain: fc.domain(),
          scanId: fc.uuid()
        }),
        (testData) => {
          const mockOnCategoryUpdate = vi.fn();
          
          // Use the same category for both ML and actual
          const { container, unmount } = render(
            <MLClassificationDropdown
              currentMLClassification={testData.category}
              actualCategory={testData.category}
              mlConfidence={testData.mlConfidence}
              mlConfidenceLevel={testData.mlConfidenceLevel}
              cookieName={testData.cookieName}
              cookieDomain={testData.cookieDomain}
              scanId={testData.scanId}
              onCategoryUpdate={mockOnCategoryUpdate}
            />
          );

          // Property: Agreement indicator (green checkmark) should be present
          const agreementIcon = container.querySelector('.agreement-icon');
          expect(agreementIcon).toBeTruthy();
          
          // Disagreement indicator should NOT be present
          const disagreementIcon = container.querySelector('.disagreement-icon');
          expect(disagreementIcon).toBeFalsy();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show disagreement indicator when ML differs from actual category', () => {
    fc.assert(
      fc.property(
        fc.record({
          mlClassification: fc.constantFrom(...VALID_CATEGORIES),
          actualCategory: fc.constantFrom(...VALID_CATEGORIES),
          mlConfidence: fc.double({ min: 0, max: 1 }),
          mlConfidenceLevel: fc.constantFrom('High', 'Medium', 'Low'),
          cookieName: fc.string({ minLength: 1, maxLength: 50 }),
          cookieDomain: fc.domain(),
          scanId: fc.uuid()
        }).filter(data => data.mlClassification !== data.actualCategory), // Ensure they're different
        (testData) => {
          const mockOnCategoryUpdate = vi.fn();
          
          const { container, unmount } = render(
            <MLClassificationDropdown
              currentMLClassification={testData.mlClassification}
              actualCategory={testData.actualCategory}
              mlConfidence={testData.mlConfidence}
              mlConfidenceLevel={testData.mlConfidenceLevel}
              cookieName={testData.cookieName}
              cookieDomain={testData.cookieDomain}
              scanId={testData.scanId}
              onCategoryUpdate={mockOnCategoryUpdate}
            />
          );

          // Property: Disagreement indicator (orange warning) should be present
          const disagreementIcon = container.querySelector('.disagreement-icon');
          expect(disagreementIcon).toBeTruthy();
          
          // Agreement indicator should NOT be present
          const agreementIcon = container.querySelector('.agreement-icon');
          expect(agreementIcon).toBeFalsy();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
