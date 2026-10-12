import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, AlertTriangle, Info, Check, Ban, ChevronRight } from 'lucide-react';
import './ConfidenceBadge.css';

/**
 * ConfidenceBadge Component
 * Displays ML confidence level as a clickable badge with sparkle icon
 * Opens a redesigned modal explaining the confidence level when clicked
 */
function ConfidenceBadge({
  confidence,
  confidenceLevel,
  cookieName,
  mlClassification,
  actualCategory,
  classificationSource = 'ml_prediction',
  classificationStatus = 'classified',
  onConfirm,
  onIgnore
}) {
  const [showModal, setShowModal] = useState(false);
  const [actionTaken, setActionTaken] = useState(null);
  const modalRef = useRef(null);

  const confidencePercent = Math.round((confidence || 0) * 100);
  const level = (confidenceLevel || 'low').toLowerCase();
  const hasDisagreement = actualCategory && actualCategory !== mlClassification;
  const isModelResult = classificationSource === 'ml_prediction';

  // Trap focus inside modal for accessibility
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const levelConfig = {
    high: {
      title: 'High Confidence',
      icon: TrendingUp,
      description: `The ML model is ${confidencePercent}% confident in this classification.`,
      signals: [
        'The model returned a score above the high-confidence threshold',
        'Interpret the score with its model version and classification source',
        'Production calibration is not yet independently verified'
      ],
      recommendation: 'Eligible for automatic use only when the caller has explicitly enabled the configured policy.',
      recType: 'positive'
    },
    medium: {
      title: 'Medium Confidence',
      icon: AlertTriangle,
      description: `The ML model is ${confidencePercent}% confident in this classification.`,
      signals: [
        'The score falls in the configured review range',
        'This result has not met the auto-classification threshold',
        'Manual review can provide a verified label'
      ],
      recommendation: 'Review recommended — this score is model output, not verified ground truth.',
      recType: 'caution'
    },
    low: {
      title: 'Low Confidence',
      icon: Info,
      description: `The ML model is only ${confidencePercent}% confident in this classification.`,
      signals: [
        'The score is below the configured classification threshold',
        'No claim is made about why the model produced this score',
        'Treat the result as an abstention until reviewed'
      ],
      recommendation: 'Manual review is strongly recommended to verify this classification.',
      recType: 'warning'
    }
  };

  if (!isModelResult) {
    levelConfig.low = {
      title: 'Rule fallback',
      icon: Info,
      description: 'The ML service was unavailable. Deterministic rules supplied this suggestion with no model confidence.',
      signals: [
        `Classification source: ${classificationSource}`,
        'Confidence is intentionally recorded as 0%',
        'Manual review is required',
      ],
      recommendation: 'Review this rule-based suggestion before publishing it.',
      recType: 'warning',
    };
  } else if (classificationStatus === 'abstained') {
    levelConfig.low = {
      title: 'Model abstained',
      icon: Info,
      description: `The ${confidencePercent}% score did not meet the configured classification threshold.`,
      signals: [
        'No known category was automatically assigned',
        'The model suggestion is retained only for review',
        'Manual verification is required',
      ],
      recommendation: 'Choose a category only after reviewing the cookie evidence.',
      recType: 'warning',
    };
  }

  const config = levelConfig[level] || levelConfig.low;
  const Icon = config.icon;

  const handleConfirm = () => {
    setActionTaken('confirmed');
    if (onConfirm) {
      onConfirm(cookieName, mlClassification, confidence);
    }
    setTimeout(() => setShowModal(false), 1200);
  };

  const handleIgnore = () => {
    setActionTaken('ignored');
    if (onIgnore) {
      onIgnore(cookieName);
    }
    setTimeout(() => setShowModal(false), 1200);
  };

  return (
    <>
      {/* Badge trigger */}
      <button
        className={`cb-badge cb-badge--${level}`}
        onClick={() => { setShowModal(true); setActionTaken(null); }}
        title={`${confidencePercent}% confidence — click for details`}
      >
        <img
          src="/spak-animation.svg"
          alt=""
          className="cb-badge__sparkle"
          width="12"
          height="12"
        />
        <span className="cb-badge__label">{confidenceLevel || 'Low'}</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="cb-overlay"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${config.title} details`}
        >
          <div
            className="cb-modal"
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
          >
            {/* ── Header with confidence ring ── */}
            <div className={`cb-modal__header cb-modal__header--${level}`}>
              <button
                className="cb-modal__close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="cb-modal__hero">
                <div className={`cb-ring cb-ring--${level}`}>
                  <svg viewBox="0 0 80 80" className="cb-ring__svg">
                    <circle cx="40" cy="40" r="34" className="cb-ring__track" />
                    <circle
                      cx="40" cy="40" r="34"
                      className="cb-ring__fill"
                      strokeDasharray={`${confidencePercent * 2.136} 213.6`}
                    />
                  </svg>
                  <div className="cb-ring__content">
                    <span className="cb-ring__percent">{confidencePercent}</span>
                    <span className="cb-ring__unit">%</span>
                  </div>
                </div>
                <div className="cb-modal__title-group">
                  <div className={`cb-modal__level-tag cb-modal__level-tag--${level}`}>
                    <Icon size={14} />
                    <span>{config.title}</span>
                  </div>
                  <p className="cb-modal__subtitle">{config.description}</p>
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="cb-modal__body">
              {/* Cookie metadata */}
              <div className="cb-meta">
                <div className="cb-meta__row">
                  <span className="cb-meta__key">Cookie</span>
                  <span className="cb-meta__val cb-meta__val--mono">{cookieName}</span>
                </div>
                <div className="cb-meta__divider" />
                <div className="cb-meta__row">
                  <span className="cb-meta__key">ML Classification</span>
                  <span className={`cb-meta__tag cb-meta__tag--ml`}>{mlClassification}</span>
                </div>
                {hasDisagreement && (
                  <>
                    <div className="cb-meta__divider" />
                    <div className="cb-meta__row">
                      <span className="cb-meta__key">Rule-Based</span>
                      <span className="cb-meta__tag cb-meta__tag--rule">{actualCategory}</span>
                    </div>
                    <div className="cb-meta__conflict">
                      <AlertTriangle size={12} />
                      <span>Classifications disagree — manual review recommended</span>
                    </div>
                  </>
                )}
              </div>

              {/* Confidence signals */}
              <div className="cb-signals">
                <h4 className="cb-section-title">Confidence Signals</h4>
                <div className="cb-signals__list">
                  {config.signals.map((signal, idx) => (
                    <div key={idx} className={`cb-signal cb-signal--${level}`}>
                      <ChevronRight size={12} className="cb-signal__icon" />
                      <span>{signal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className={`cb-rec cb-rec--${config.recType}`}>
                <div className="cb-rec__icon">
                  <Info size={14} />
                </div>
                <p className="cb-rec__text">{config.recommendation}</p>
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="cb-modal__footer">
              {actionTaken ? (
                <div className={`cb-feedback cb-feedback--${actionTaken}`}>
                  {actionTaken === 'confirmed' ? (
                    <><Check size={16} /> Classification confirmed and saved</>
                  ) : (
                    <><Ban size={16} /> Confidence ignored for this cookie</>
                  )}
                </div>
              ) : (
                <div className="cb-actions">
                  <button className="cb-btn cb-btn--confirm" onClick={handleConfirm}>
                    <Check size={15} />
                    <span>Confirm & Save</span>
                  </button>
                  <button className="cb-btn cb-btn--ignore" onClick={handleIgnore}>
                    <Ban size={15} />
                    <span>Ignore</span>
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
