import React, { useState, useEffect } from 'react';
import { criteriaService, CriteriaConfig } from '../services/criteria-service';
import { useAuth } from '../contexts/AuthContext';

interface CriteriaEditorProps {
  type: 'project' | 'funding' | 'resource';
  onSave?: () => void;
}

export const CriteriaEditor: React.FC<CriteriaEditorProps> = ({ type, onSave }) => {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<CriteriaConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<Record<string, any>>({});
  const [priorities, setPriorities] = useState<string[]>([]);

  useEffect(() => {
    loadCriteria();
  }, [type]);

  const loadCriteria = async () => {
    try {
      const data = await criteriaService.getCriteria(type);
      setCriteria(data);
      setRequiredFields(data.required_fields);
      setWeights(data.scoring_weights);
      setRules(data.validation_rules);
      setPriorities(data.enrichment_priorities);
    } catch (error) {
      console.error('Failed to load criteria:', error);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {return;}
    
    setIsSaving(true);
    try {
      // Validate weights sum to 1
      const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (Math.abs(weightSum - 1) > 0.01) {
        alert('Scoring weights must sum to 1.0');
        return;
      }

      await criteriaService.updateCriteria(
        type,
        {
          required_fields: requiredFields,
          scoring_weights: weights,
          validation_rules: rules,
          enrichment_priorities: priorities
        },
        user.id
      );

      setIsEditing(false);
      await loadCriteria();
      onSave?.();
    } catch (error) {
      console.error('Failed to save criteria:', error);
      alert('Failed to save criteria');
    } finally {
      setIsSaving(false);
    }
  };

  const addRequiredField = () => {
    const field = prompt('Enter field name:');
    if (field && !requiredFields.includes(field)) {
      setRequiredFields([...requiredFields, field]);
    }
  };

  const removeRequiredField = (field: string) => {
    setRequiredFields(requiredFields.filter(f => f !== field));
  };

  const updateWeight = (key: string, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  const addWeight = () => {
    const key = prompt('Enter weight name:');
    if (key && !weights[key]) {
      setWeights({ ...weights, [key]: 0.1 });
    }
  };

  const removeWeight = (key: string) => {
    const { [key]: _, ...rest } = weights;
    setWeights(rest);
  };

  const updateRule = (key: string, value: any) => {
    setRules({ ...rules, [key]: value });
  };

  const addRule = () => {
    const key = prompt('Enter rule name:');
    if (key && !rules[key]) {
      const value = prompt('Enter rule value:');
      setRules({ ...rules, [key]: value });
    }
  };

  const removeRule = (key: string) => {
    const { [key]: _, ...rest } = rules;
    setRules(rest);
  };

  const addPriority = () => {
    const priority = prompt('Enter enrichment priority:');
    if (priority && !priorities.includes(priority)) {
      setPriorities([...priorities, priority]);
    }
  };

  const removePriority = (priority: string) => {
    setPriorities(priorities.filter(p => p !== priority));
  };

  const movePriority = (index: number, direction: 'up' | 'down') => {
    const newPriorities = [...priorities];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < priorities.length) {
      [newPriorities[index], newPriorities[newIndex]] = [newPriorities[newIndex], newPriorities[index]];
      setPriorities(newPriorities);
    }
  };

  if (!criteria) {return <div>Loading criteria...</div>;}

  return (
    <div className="criteria-editor bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{criteria.name}</h2>
          <p className="text-gray-600">{criteria.description}</p>
          <p className="text-sm text-gray-500 mt-1">Version {criteria.version}</p>
        </div>
        <div className="space-x-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Criteria
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadCriteria();
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Required Fields */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Required Fields</h3>
            {isEditing && (
              <button
                onClick={addRequiredField}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                + Add Field
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {requiredFields.map(field => (
              <div
                key={field}
                className="px-3 py-1 bg-gray-100 rounded-full flex items-center gap-2"
              >
                <span>{field}</span>
                {isEditing && (
                  <button
                    onClick={() => removeRequiredField(field)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scoring Weights */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Scoring Weights</h3>
            {isEditing && (
              <button
                onClick={addWeight}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                + Add Weight
              </button>
            )}
          </div>
          <div className="space-y-2">
            {Object.entries(weights).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-32 font-medium">{key}:</span>
                {isEditing ? (
                  <>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={value}
                      onChange={(e) => updateWeight(key, parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{(value * 100).toFixed(0)}%</span>
                    <button
                      onClick={() => removeWeight(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="pt-2 border-t">
              <span className="font-medium">Total:</span>
              <span className={`ml-2 ${Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                {(Object.values(weights).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Validation Rules */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Validation Rules</h3>
            {isEditing && (
              <button
                onClick={addRule}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                + Add Rule
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(rules).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="font-medium">{key}:</span>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={typeof value === 'object' ? JSON.stringify(value) : value}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          updateRule(key, parsed);
                        } catch {
                          updateRule(key, e.target.value);
                        }
                      }}
                      className="flex-1 px-2 py-1 border rounded"
                    />
                    <button
                      onClick={() => removeRule(key)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span className="text-gray-600">
                    {typeof value === 'object' ? JSON.stringify(value) : value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Enrichment Priorities */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Enrichment Priorities</h3>
            {isEditing && (
              <button
                onClick={addPriority}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                + Add Priority
              </button>
            )}
          </div>
          <div className="space-y-2">
            {priorities.map((priority, index) => (
              <div
                key={priority}
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded"
              >
                <span className="text-gray-500 font-mono">{index + 1}.</span>
                <span className="flex-1">{priority}</span>
                {isEditing && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => movePriority(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePriority(index, 'down')}
                      disabled={index === priorities.length - 1}
                      className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePriority(priority)}
                      className="px-2 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};