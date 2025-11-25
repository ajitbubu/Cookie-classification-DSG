import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import './CategoryDropdown.css';

const CATEGORIES = [
  { value: 'Strictly Necessary', label: 'Strictly Necessary', color: '#00C4A8' },
  { value: 'Functional', label: 'Functional', color: '#3D8BFF' },
  { value: 'Analytics', label: 'Analytics', color: '#FFBC32' },
  { value: 'Marketing', label: 'Marketing', color: '#FF4D4D' },
  { value: 'Preferences', label: 'Preferences', color: '#9B59B6' },
  { value: 'Uncategorized', label: 'Uncategorized', color: '#95A5A6' }
];

function CategoryDropdown({ 
  currentCategory, 
  cookieName, 
  cookieDomain, 
  scanId,
  onCategoryChange 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedCategory(currentCategory);
  }, [currentCategory]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = async (newCategory) => {
    if (newCategory === selectedCategory) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);

    try {
      // Call API to update category
      const response = await fetch('http://localhost:8000/api/categories/update-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan_id: scanId,
          cookie_name: cookieName,
          cookie_domain: cookieDomain,
          old_category: selectedCategory,
          new_category: newCategory
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedCategory(newCategory);
        
        // Notify parent component
        if (onCategoryChange) {
          onCategoryChange(cookieName, cookieDomain, newCategory);
        }

        // Show success feedback
        console.log('Category updated:', data);
      } else {
        console.error('Failed to update category');
        alert('Failed to update category. Please try again.');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Error updating category. Please try again.');
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const getCategoryColor = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.color : '#95A5A6';
  };

  const getCategoryClass = (category) => {
    return category.toLowerCase().replace(/\s+/g, '-');
  };

  return (
    <div className="category-dropdown" ref={dropdownRef}>
      <button
        className={`category-dropdown-trigger category-${getCategoryClass(selectedCategory)}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
      >
        <span className="category-label">{selectedCategory}</span>
        <ChevronDown size={14} className={`dropdown-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="category-dropdown-menu">
          {CATEGORIES.map((category) => (
            <button
              key={category.value}
              className={`category-dropdown-item ${selectedCategory === category.value ? 'selected' : ''}`}
              onClick={() => handleCategorySelect(category.value)}
            >
              <span 
                className="category-color-indicator"
                style={{ backgroundColor: category.color }}
              />
              <span className="category-item-label">{category.label}</span>
              {selectedCategory === category.value && (
                <Check size={16} className="check-icon" />
              )}
            </button>
          ))}
        </div>
      )}

      {isUpdating && (
        <div className="category-updating-overlay">
          <div className="spinner-small"></div>
        </div>
      )}
    </div>
  );
}

export default CategoryDropdown;
