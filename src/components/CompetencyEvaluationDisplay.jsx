/**
 * CompetencyEvaluationDisplay Component
 * Display competency evaluation scores and comments for instructors
 */

import React from 'react';
import { COMPETENCY_CRITERIA, OVERALL_COMPETENCY_LEVELS } from '../services/gemini/competencyEvaluationService';

const CompetencyEvaluationDisplay = ({ evaluation, showDetails = true }) => {
  if (!evaluation || !evaluation.TC1) {
    return null;
  }

  // Get overall level based on total score
  const getOverallLevel = (score) => {
    if (score <= 3) return 'need_effort';
    if (score <= 6) return 'achieved';
    return 'good';
  };

  const overallLevel = getOverallLevel(evaluation.totalCompetencyScore);
  const levelColor = OVERALL_COMPETENCY_LEVELS[overallLevel];

  const getLevelColor = (level) => {
    const colors = {
      'need_effort': '#EF4444',
      'achieved': '#F59E0B',
      'good': '#10B981'
    };
    return colors[level] || '#6B7280';
  };

  const getLevelLabel = (level) => {
    const labels = {
      'need_effort': 'Cần cố gắng',
      'achieved': 'Đạt',
      'good': 'Tốt'
    };
    return labels[level] || level;
  };

  return (
    <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-indigo-900 mb-2">📊 Đánh giá Năng lực</h3>
      </div>

      {/* Overall Score Display */}
      <div className={`mb-6 p-4 rounded-lg border-l-4 flex justify-between items-center`}
           style={{ 
             borderLeftColor: levelColor.color,
             backgroundColor: levelColor.color + '10'
           }}>
        <div>
          <div className="text-base text-gray-600 font-medium">Mức Năng lực Chung</div>
          <div className="text-3xl font-bold" style={{ color: levelColor.color }}>
            {levelColor.label}
          </div>
        </div>
 
      </div>

      {/* Individual Criteria */}
      <div className="space-y-4">
        {['TC1', 'TC2', 'TC3', 'TC4'].map((criterion) => {
          const data = evaluation[criterion];
          if (!data) return null;
          
          const criteria = COMPETENCY_CRITERIA[criterion];
          
          // Handle both database format (diem, nhanXet) and old format (score, comment)
          const score = data.score !== undefined ? data.score : (data.diem || 0);
          const comment = data.comment || data.nhanXet || '';
          const level = data.level || 'need_effort';
          const color = getLevelColor(level);

          return (
            <div key={criterion} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              {/* Criterion Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-lg text-gray-900">{criterion}. {criteria.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{criteria.description}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded-full text-white text-base font-bold"
                       style={{ backgroundColor: color }}>
                    {getLevelLabel(level)}
                  </div>
                </div>
              </div>

              {/* Score Bar */}
              <div className="bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className="h-full transition-all"
                  style={{ 
                    width: `${(score / 2) * 100}%`,
                    backgroundColor: color
                  }}
                />
              </div>

              {/* Comment */}
              {comment && (
                <div className="bg-gray-50 rounded p-4 text-base text-gray-700 leading-relaxed border-l-2" style={{ borderLeftColor: color }}>
                  💬 {comment}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompetencyEvaluationDisplay;
