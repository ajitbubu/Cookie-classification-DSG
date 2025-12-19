import React, { useState } from 'react';
import { X, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import './ConfidenceBadge.css';

/**
 * ConfidenceBadge Component
 * Displays ML confidence level as a clickable badge with sparkle icon
 * Opens a modal explaining the confidence level when clicked
 */
function ConfidenceBadge({ 
  confidence, 
  confidenceLevel, 
  cookieName,
  mlClassification,
  actualCategory,
  onConfirm,
  onIgnore
}) {
  const [showModal, setShowModal] = useState(false);
  const [actionTaken, setActionTaken] = useState(null);

  // Get confidence percentage
  const confidencePercent = Math.round((confidence || 0) * 100);
  
  // Determine badge color and icon based on confidence level
  const getBadgeClass = () => {
    const level = (confidenceLevel || 'low').toLowerCase();
    return `confidence-badge-btn confidence-${level}`;
  };

  // Get explanation for confidence level
  const getExplanation = () => {
    const level = (confidenceLevel || 'low').toLowerCase();
    
    const explanations = {
      high: {
        title: 'High Confidence',
        icon: <TrendingUp size={24} />,
        description: `The ML model is ${confidencePercent}% confident in this classification.`,
        details: [
          'Strong pattern match with training data',
          'Cookie name and properties align well with known patterns',
          'Multiple features support this classification',
          'Low uncertainty in prediction'
        ],
        recommendation: 'This classification is highly reliable and can be trusted.'
      },
      medium: {
        title: 'Medium Confidence',
        icon: <AlertTriangle size={24} />,
        description: `The ML model is ${confidencePercent}% confident in this classification.`,
        details: [
          'Moderate pattern match with training data',
          'Some features support this classification',
          'Cookie properties partially align with known patterns',
          'Some uncertainty in prediction'
        ],
        recommendation: 'This classification is reasonably reliable but may benefit from manual review.'
      },
      low: {
        title: 'Low Confidence',
        icon: <Info size={24} />,
        description: `The ML model is only ${confidencePercent}% confident in this classification.`,
        details: [
          'Weak pattern match with training data',
          'Cookie name or properties are unusual',
          'Limited features support this classification',
          'High uncertainty in prediction'
        ],
        recommendation: 'Manual review is recommended to verify this classification.'
      }
    };

    return explanations[level] || explanations.low;
  };

  const explanation = getExplanation();

  return (
    <>
      <button
        className={getBadgeClass()}
        onClick={() => setShowModal(true)}
        title={`Click to see why confidence is ${confidenceLevel}`}
      >
        <img 
          src="/spak-animation.svg" 
          alt="" 
          className="sparkle-icon"
          width="12"
          height="12"
        />
        <span className="confidence-text">{confidenceLevel || 'Low'}</span>
      </button>

      {showModal && (
        <div className="confidence-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="confidence-modal slim" onClick={(e) => e.stopPropagation()}>
            {/* Compact Header */}
            <div className="confidence-modal-header">
              <div className={`confidence-level-badge confidence-${(confidenceLevel || 'low').toLowerCase()}`}>
                {explanation.icon}
                <span>{explanation.title}</span>
              </div>
              <button 
                className="confidence-modal-close"
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Slim Content with All Information */}
            <div className="confidence-modal-content">
              {/* Cookie Info - Compact */}
              <div className="confidence-info-compact">
                <div className="info-item">
                  <span className="label">Cookie:</span>
                  <span className="value">{cookieName}</span>
                </div>
                <div className="info-item">
                  <span className="label">ML Classification:</span>
                  <span className="value">{mlClassification}</span>
                </div>
                {actualCategory && actualCategory !== mlClassification && (
                  <div className="info-item">
                    <span className="label">Rule-Based:</span>
                    <span className="value">{actualCategory}</span>
                  </div>
                )}
              </div>

              {/* Description - Compact */}
              <div className="slim-section">
                <h4 className="slim-title">What This Means</h4>
                <p className="slim-text">{explanation.description}</p>
              </div>

              {/* Confidence Bar - Slim */}
              <div className="confidence-bar-slim">
                <div className="bar-header">
                  <span className="bar-label">Confidence Score</span>
                  <span className="bar-percent">{confidencePercent}%</span>
                </div>
                <div className="bar-track">
                  <div 
                    className={`bar-fill confidence-${(confidenceLevel || 'low').toLowerCase()}`}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                <div className="bar-scale">
                  <span>0%</span>
                  <span>Low (0-65%)</span>
                  <span>Medium (65-85%)</span>
                  <span>High (85-100%)</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Details - Compact List */}
              <div className="slim-section">
                <h4 className="slim-title">Why This Confidence Level?</h4>
                <ul className="slim-list">
                  {explanation.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>

              {/* Recommendation - Compact */}
              <div className="slim-recommendation">
                <div className="rec-icon">
                  <Info size={14} />
                </div>
                <div className="rec-content">
                  <h4 className="rec-title">Recommendation</h4>
                  <p className="rec-text">{explanation.recommendation}</p>
                </div>
              </div>

              {/* Action Buttons - Compact */}
              {actionTaken ? (
                <div className="action-feedback">
                  <div className={`feedback-msg ${actionTaken}`}>
                    {actionTaken === 'confirmed' ? '✓ Classification confirmed and saved' : '⊘ Confidence ignored for this cookie'}
                  </div>
                </div>
              ) : (
                <div className="action-buttons">
                  <button
                    className="action-btn confirm"
                    onClick={() => {
                      setActionTaken('confirmed');
                      if (onConfirm) {
                        onConfirm(cookieName, mlClassification, confidence);
                      }
                      setTimeout(() => setShowModal(false), 1500);
                    }}
                  >
                    ✓ Confirm & Save
                  </button>
                  <button
                    className="action-btn ignore"
                    onClick={() => {
                      setActionTaken('ignored');
                      if (onIgnore) {
                        onIgnore(cookieName);
                      }
                      setTimeout(() => setShowModal(false), 1500);
                    }}
                  >
                    ⊘ Always Ignore
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConfidenceBadge;
