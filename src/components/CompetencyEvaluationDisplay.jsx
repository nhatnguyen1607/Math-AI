/**
 * CompetencyEvaluationDisplay Component
 * Display competency evaluation scores and comments for instructors
 */

import React from 'react';
import { COMPETENCY_CRITERIA, OVERALL_COMPETENCY_LEVELS } from '../services/competencyEvaluationService';

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
        <h3 className="text-xl font-bold text-indigo-900 mb-2">📊 Đánh giá Năng lực</h3>
        <p className="text-gray-600 text-sm">
          Đánh giá dựa trên 4 tiêu chí theo khung giáo dục. Tổng điểm: 0-8 (<span style={{ color: levelColor.color }} className="font-bold">{evaluation.totalCompetencyScore}/8 - {levelColor.label}</span>)
        </p>
      </div>

      {/* Overall Score Display */}
      <div className={`mb-6 p-4 rounded-lg border-l-4 flex justify-between items-center`}
           style={{ 
             borderLeftColor: levelColor.color,
             backgroundColor: levelColor.color + '10'
           }}>
        <div>
          <div className="text-sm text-gray-600 font-medium">Mức Năng lực Chung</div>
          <div className="text-2xl font-bold" style={{ color: levelColor.color }}>
            {evaluation.totalCompetencyScore}/8 - {levelColor.label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-gray-300">{Math.round((evaluation.totalCompetencyScore / 8) * 100)}%</div>
        </div>
      </div>

      {/* Individual Criteria */}
      <div className="space-y-4">
        {['TC1', 'TC2', 'TC3', 'TC4'].map((criterion) => {
          const data = evaluation[criterion];
          const criteria = COMPETENCY_CRITERIA[criterion];
          const color = getLevelColor(data.level);

          return (
            <div key={criterion} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
              {/* Criterion Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">{criterion}. {criteria.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{criteria.description}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded-full text-white text-sm font-bold"
                       style={{ backgroundColor: color }}>
                    {getLevelLabel(data.level)}
                  </div>
                  <div className="text-2xl font-bold mt-2" style={{ color: color }}>
                    {data.score}/2
                  </div>
                </div>
              </div>

              {/* Score Bar */}
              <div className="bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                <div 
                  className="h-full transition-all"
                  style={{ 
                    width: `${(data.score / 2) * 100}%`,
                    backgroundColor: color
                  }}
                />
              </div>

              {/* Comment */}
              {data.comment && (
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 italic border-l-2" style={{ borderLeftColor: color }}>
                  💬 {data.comment}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend/Explanation */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-300">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#10B981' }}></div>
              <div className="font-bold text-gray-900">7-8 điểm</div>
              <div className="text-gray-600">Tốt</div>
            </div>
            <div className="text-center">
              <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#F59E0B' }}></div>
              <div className="font-bold text-gray-900">4-6 điểm</div>
              <div className="text-gray-600">Đạt</div>
            </div>
            <div className="text-center">
              <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#EF4444' }}></div>
              <div className="font-bold text-gray-900">0-3 điểm</div>
              <div className="text-gray-600">Cần cố gắng</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetencyEvaluationDisplay;
