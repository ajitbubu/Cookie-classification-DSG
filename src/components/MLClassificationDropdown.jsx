import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, AlertTriangle, CheckCircle } from 'lucide-react';
import './MLClassificationDropdown.css';

/**
 * Available cookie categories with their display labels and colors
 */
const CATEGORIES = [
  { value: 'Strictly Necessary', label: 'Strictly Necessary', color: '#00C4A8' },
  { value: 'Functional', label: 'Functional', color: '#3D8BFF' },
  { value: 'Analytics', label: 'Analytics', color: '#FFBC32' },
  { value: 'Marketing', label: 'Marketing', color: '#FF4D4D' },
  { value: 'Preferences', label: 'Preferences', color: '#9B59B6' },
  { value: 'Uncategorized', label: 'Uncategorized', color: '#95A5A6' }
];

/**
 * MLClassificationDropdown Component
 * 
 * Displays the ML-predicted cookie category in an interactive dropdown that allows users
 * to update the actual cookie category. Shows confidence levels and visual indicators
 * for agreement/disagreement between ML prediction and actual category.
 * 
 * @component
 * @example
 * ```jsx
 * <MLClassificationDropdown
 *   currentMLClassification="Analytics"
 *   actualCategory="Marketing"
 *   mlConfidence={0.85}
 *   mlConfidenceLevel="High"
 *   cookieName="_ga"
 *   cookieDomain=".example.com"
 *   scanId="1234567890"
 *   onCategoryUpdate={handleCategoryUpdate}
 * />
 * ```
 * 
 * @param {Object} props - Component props
 * @param {string} props.currentMLClassification - The ML-predicted category for this cookie
 * @param {string} props.actualCategory - The current stored category in the database
 * @param {number} [props.mlConfidence] - Confidence score from 0-1 (e.g., 0.85 = 85%)
 * @param {string} [props.mlConfidenceLevel] - Human-readable confidence level ("High", "Medium", "Low")
 * @param {string} props.cookieName - Name of the cookie being classified
 * @param {string} props.cookieDomain - Domain of the cookie
 * @param {string} props.scanId - Unique identifier for the current scan
 * @param {Function} props.onCategoryUpdate - Callback function when category is updated: (name, domain, newCategory) => void
 * 
 * @returns {JSX.Element} The rendered dropdown component
 */
function MLClassificationDropdown({ 
  currentMLClassification, 
  actualCategory,
  mlConfidence,
  mlConfidenceLevel,
  cookieName, 
  cookieDomain, 
  scanId,
  onCategoryUpdate 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // The dropdown shows the actual category (what's stored), not the ML suggestion
  const displayedCategory = actualCategory || 'Uncategorized';

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev < CATEGORIES.length - 1 ? prev + 1 : 0;
            return next;
          });
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev > 0 ? prev - 1 : CATEGORIES.length - 1;
            return next;
          });
          break;
        
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < CATEGORIES.length) {
            handleCategorySelect(CATEGORIES[focusedIndex].value);
          }
          break;
        
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        
        case 'End':
          e.preventDefault();
          setFocusedIndex(CATEGORIES.length - 1);
          break;
        
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex]);

  // Focus management - scroll focused item into view for keyboard navigation
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll('.ml-dropdown-item');
      if (items[focusedIndex]) {
        items[focusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, isOpen]);

  /**
   * Handles category selection from the dropdown
   * Performs optimistic UI update and calls parent's update handler
   * 
   * @param {string} newCategory - The newly selected category
   */
  const handleCategorySelect = async (newCategory) => {
    // Skip update if category hasn't changed
    if (newCategory === actualCategory) {
      setIsOpen(false);
      setFocusedIndex(-1);
      return;
    }

    setIsUpdating(true);
    setError(null);
    setUpdateMessage('');

    try {
      // Call the parent's category update handler (which handles API call and state update)
      await onCategoryUpdate(cookieName, cookieDomain, newCategory);
      setUpdateMessage(`Category updated to ${newCategory}`);
      setIsOpen(false);
      setFocusedIndex(-1);
      
      // Clear success message after 3 seconds
      setTimeout(() => setUpdateMessage(''), 3000);
      
      // Return focus to trigger button for accessibility
      setTimeout(() => triggerRef.current?.focus(), 100);
    } catch (err) {
      setError('Failed to update category');
      setUpdateMessage('Failed to update category');
      // Error will be shown briefly then cleared
      setTimeout(() => {
        setError(null);
        setUpdateMessage('');
      }, 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Converts category name to CSS class name
   * @param {string} category - Category name
   * @returns {string} CSS-safe class name
   */
  const getCategoryClass = (category) => {
    return category.toLowerCase().replace(/\s+/g, '-');
  };

  return (
    <div className="ml-classification-dropdown" ref={dropdownRef}>
      <div className="ml-dropdown-wrapper">
        <button
          ref={triggerRef}
          className={`ml-dropdown-trigger ml-category-${getCategoryClass(displayedCategory)}`}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setFocusedIndex(-1);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !isOpen) {
              e.preventDefault();
              setIsOpen(true);
              setFocusedIndex(0);
            }
          }}
          disabled={isUpdating}
          aria-label={`Current category: ${displayedCategory}. ML suggests: ${currentMLClassification}. Press Enter or Space to open category selection menu.`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="ml-category-listbox"
          title={`Current: ${displayedCategory}${currentMLClassification && currentMLClassification !== displayedCategory ? ` | ML suggests: ${currentMLClassification}` : ''}`}
        >
          <span className="ml-category-label">{displayedCategory}</span>
          <ChevronDown size={14} className={`ml-dropdown-icon ${isOpen ? 'open' : ''}`} aria-hidden="true" />
        </button>

        {/* Tooltip */}
        <div className="ml-dropdown-tooltip" role="tooltip" aria-hidden="true">
          Selecting a category will update the actual category
        </div>
      </div>

      {isOpen && (
        <div 
          ref={menuRef}
          className="ml-dropdown-menu"
          role="listbox"
          id="ml-category-listbox"
          aria-label="Cookie category options"
        >
          {CATEGORIES.map((category, index) => (
            <button
              key={category.value}
              className={`ml-dropdown-item ${actualCategory === category.value ? 'selected' : ''} ${focusedIndex === index ? 'focused' : ''}`}
              onClick={() => handleCategorySelect(category.value)}
              onMouseEnter={() => setFocusedIndex(index)}
              role="option"
              aria-selected={actualCategory === category.value}
              aria-label={`${category.label}${actualCategory === category.value ? ' (current category)' : ''}`}
              tabIndex={-1}
            >
              <span 
                className="ml-category-color-indicator"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              <span className="ml-category-item-label">{category.label}</span>
              {actualCategory === category.value && (
                <Check size={16} className="ml-check-icon" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}

      {isUpdating && (
        <div className="ml-updating-overlay" aria-live="polite" aria-busy="true">
          <div className="ml-spinner-small" role="status" aria-label="Updating category"></div>
        </div>
      )}

      {error && (
        <div className="ml-error-message" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      
      {/* Screen reader announcements for category updates */}
      {updateMessage && (
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {updateMessage}
        </div>
      )}
    </div>
  );
}

export default MLClassificationDropdown;
