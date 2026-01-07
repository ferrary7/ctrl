'use client';

import { useState, useEffect } from 'react';

/**
 * Territory info card - shows details when clicking a territory
 */

export default function TerritoryCard({ territory, onClose }) {
  const [activityDetails, setActivityDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  
  if (!territory) return null;
  
  // Fetch activity details
  useEffect(() => {
    if (territory.activityId) {
      setLoading(true);
      
      fetch(`/api/activities/${territory.activityId}`)
        .then(res => res.json())
        .then(data => {
          setActivityDetails(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch activity details:', err);
          setLoading(false);
        });
    }
  }, [territory.activityId]);
  
  // Calculate days held and status
  const daysHeld = territory.daysHeld || 0;
  const strength = territory.strength || 100;
  
  const getStatus = () => {
    if (daysHeld < 7) return { label: 'Fresh', color: 'bg-green-400' };
    if (daysHeld < 30) return { label: 'Vulnerable', color: 'bg-yellow-400' };
    return { label: 'Decaying', color: 'bg-red-400' };
  };
  
  const status = getStatus();
  
  return (
    <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto md:w-72 lg:w-80 bg-gray-900 rounded-lg border border-gray-800 shadow-xl z-30 max-h-[calc(100vh-6rem)] md:max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <div className="p-2 md:p-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm md:text-base font-semibold text-white">Territory</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors z-40 p-1 hover:bg-gray-800 rounded"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-2 md:p-3 space-y-2 md:space-y-2.5 overflow-y-auto flex-1">
        <div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <p className="text-sm md:text-base font-semibold text-white">
              {territory.name || 'Unnamed Territory'}
            </p>
            {territory.activityType && (
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                territory.activityType === 'Run' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : territory.activityType === 'Ride'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
                {territory.activityType === 'Run' ? '🏃' : territory.activityType === 'Ride' ? '🚴' : '🚶'} {territory.activityType}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Controlled by {territory.userName || 'Unknown'}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 md:gap-2">
          <div className="bg-gray-800 rounded p-1.5 md:p-2">
            <p className="text-xs text-gray-400 mb-0.5">Area</p>
            <p className="text-sm md:text-base font-semibold text-white">
              {territory.areaSqm ? (territory.areaSqm / 1_000_000).toFixed(3) : '0'} km²
            </p>
          </div>
          
          <div className="bg-gray-800 rounded p-1.5 md:p-2">
            <p className="text-xs text-gray-400 mb-0.5">Held For</p>
            <p className="text-sm md:text-base font-semibold text-white">
              {daysHeld === 0 ? 'Today' : `${daysHeld}d`}
            </p>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded p-1.5 md:p-2">
          <p className="text-xs text-gray-400 mb-1">Strength</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                style={{ width: `${Math.min(100, strength)}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-white">{strength}%</span>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded p-1.5 md:p-2">
          <p className="text-xs text-gray-400 mb-0.5">Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.color}`} />
            <p className="text-sm text-white">{status.label}</p>
          </div>
        </div>
        
        {/* Activity Details Section */}
        {activityDetails && (
          <div className="border-t border-gray-800 pt-2 mt-2 space-y-1.5 md:space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity</p>
            
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <div className="bg-gray-800 rounded p-1.5 md:p-2">
                <p className="text-xs text-gray-400 mb-0.5">Distance</p>
                <p className="text-sm md:text-base font-semibold text-white">
                  {(activityDetails.distance / 1000).toFixed(2)} km
                </p>
              </div>
              
              <div className="bg-gray-800 rounded p-1.5 md:p-2">
                <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                <p className="text-sm md:text-base font-semibold text-white">
                  {Math.floor(activityDetails.duration / 60)}:{String(activityDetails.duration % 60).padStart(2, '0')}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded p-1.5 md:p-2">
                <p className="text-xs text-gray-400 mb-0.5">Pace</p>
                <p className="text-sm md:text-base font-semibold text-white">
                  {((activityDetails.duration / 60) / (activityDetails.distance / 1000)).toFixed(2)} min/km
                </p>
              </div>
              
              <div className="bg-gray-800 rounded p-1.5 md:p-2">
                <p className="text-xs text-gray-400 mb-0.5">Type</p>
                <p className="text-sm md:text-base font-semibold text-white">
                  {activityDetails.type || 'Run'}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded p-1.5 md:p-2">
              <p className="text-xs text-gray-400 mb-0.5">Activity Name</p>
              <p className="text-xs md:text-sm text-white font-medium">
                {activityDetails.name || 'Unnamed Activity'}
              </p>
            </div>
            
            <div className="bg-gray-800 rounded p-1.5 md:p-2">
              <p className="text-xs text-gray-400 mb-0.5 md:mb-1">Completed</p>
              <p className="text-sm text-white">
                {new Date(activityDetails.startedAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="border-t border-gray-800 pt-3 mt-3">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
              Loading activity details...
            </div>
          </div>
        )}
        
        {territory.userColor && (
          <div 
            className="h-2 rounded-full mt-3"
            style={{ backgroundColor: territory.userColor }}
          />
        )}
      </div>
    </div>
  );
}
