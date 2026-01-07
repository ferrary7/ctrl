'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Battle Feed - Shows recent territory captures/losses
 */
export default function BattleFeed({ onTerritoryClick }) {
  const { data: session } = useSession();
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // Expose visibility setter to global window for cross-component control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.setBattleFeedVisible = setIsVisible;
      return () => {
        delete window.setBattleFeedVisible;
      };
    }
  }, []);
  
  // Expose visibility setter to global window for cross-component control
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.setBattleFeedVisible = setIsVisible;
      return () => {
        delete window.setBattleFeedVisible;
      };
    }
  }, []);
  
  // Function to find and fly to territory
  const flyToTerritory = async (territoryName) => {
    try {
      // Fetch all territories to find the one we're looking for
      const res = await fetch('/api/tiles?minLng=-180&minLat=-90&maxLng=180&maxLat=90&zoom=1');
      const data = await res.json();
      
      const territory = data.features?.find(f => f.properties.name === territoryName);
      
      if (territory && territory.geometry?.coordinates?.[0]) {
        // Calculate centroid
        const coords = territory.geometry.coordinates[0];
        const sumLng = coords.reduce((sum, coord) => sum + coord[0], 0);
        const sumLat = coords.reduce((sum, coord) => sum + coord[1], 0);
        const center = [sumLng / coords.length, sumLat / coords.length];
        
        // Create territory object and trigger map fly
        const territoryData = {
          ...territory.properties,
          geometry: territory.geometry,
          center
        };
        
        // Use the callback if provided
        if (onTerritoryClick) {
          onTerritoryClick(territoryData);
        }
        
        // Also fly the map to this location using global map reference
        if (typeof window !== 'undefined' && window.ctrlMap) {
          window.ctrlMap.flyTo({
            center: center,
            zoom: 14,
            duration: 1500
          });
        }
      }
    } catch (error) {
      console.error('Failed to find territory:', error);
    }
  };

  useEffect(() => {
    if (!session) return;

    const fetchBattles = async () => {
      try {
        const res = await fetch('/api/territories/history?limit=10');
        const data = await res.json();
        setBattles(data || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch battle history:', error);
        setLoading(false);
      }
    };

    fetchBattles();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBattles, 30000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || loading) return null;

  const recentBattles = battles.slice(0, 3);
  const hasMoreBattles = battles.length > 3;

  // Show toggle button when hidden
  if (!isVisible) {
    return (
      <button
        onClick={() => {
          setIsVisible(true);
          // Close territory list when opening battle feed
          if (typeof window !== 'undefined' && window.closeTerritoryList) {
            window.closeTerritoryList();
          }
        }}
        className="absolute top-4 right-4 z-20 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full p-2 md:p-3 hover:bg-zinc-800 transition-all shadow-lg group"
        title="Show Battle Feed"
      >
        <div className="flex items-center gap-2">
          {battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length > 0 && (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <svg className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length > 0 && (
            <span className="text-xs font-medium text-white">{battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-72 md:w-80 lg:w-96 z-20">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 md:px-4 md:py-3 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-zinc-900 to-zinc-900/80">
          <div className="flex items-center gap-2">
            {battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length > 0 && (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <h3 className="text-xs md:text-sm font-semibold text-white">Battle Feed</h3>
            {battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                {battles.filter(b => b.from_user_id === session.user.id || b.to_user_id === session.user.id).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasMoreBattles && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-zinc-800"
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="text-zinc-400 hover:text-white transition-colors text-lg leading-none hover:rotate-90 transition-transform duration-200"
            >
              ×
            </button>
          </div>
        </div>

        {/* Battle List */}
        <div className="max-h-[50vh] md:max-h-96 overflow-y-auto">
          {battles.length === 0 ? (
            <div className="p-4 text-center text-zinc-500 text-sm">
              No battles yet. Get out there and claim territory!
            </div>
          ) : (
            (isExpanded ? battles : recentBattles).map((battle, i) => {
              const isYourCapture = battle.to_user_id === session.user.id;
              const isYourLoss = battle.from_user_id === session.user.id;
              const isYou = isYourCapture || isYourLoss;

              return (
                <div
                  key={battle.id}
                  onClick={() => flyToTerritory(battle.territory_name)}
                  title={`Click to view ${battle.territory_name} on map`}
                  className={`p-3 md:p-4 border-b border-zinc-800 hover:bg-zinc-800/30 transition-all duration-200 cursor-pointer group active:scale-[0.99] ${
                    isYou ? 'bg-zinc-800/40 border-l-2' : ''
                  } ${
                    isYourLoss ? 'border-l-red-500' : isYourCapture ? 'border-l-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 md:gap-3">
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-base md:text-lg font-bold flex-shrink-0 shadow-lg ${
                        battle.action === 'claimed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isYourCapture
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {battle.action === 'claimed'
                        ? '🏁'
                        : isYourCapture
                        ? '⚔️'
                        : '💔'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {battle.action === 'claimed' ? (
                        <>
                          <p className="text-xs md:text-sm text-white leading-relaxed">
                            <span className="font-semibold" style={{ color: battle.to_user_color }}>
                              {battle.to_user_name}
                            </span>
                            <span className="text-zinc-400"> claimed </span>
                            <span className="font-medium text-white">{battle.territory_name}</span>
                          </p>
                          {isYourCapture && (
                            <div className="mt-1.5 text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 inline-block font-medium">
                              New Territory! +{(battle.area_change / 1000000).toFixed(2)} km²
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs md:text-sm text-white leading-relaxed">
                            <span className="font-semibold" style={{ color: battle.to_user_color }}>
                              {battle.to_user_name}
                            </span>
                            <span className="text-zinc-400"> captured </span>
                            <span className="font-medium text-white">{battle.territory_name}</span>
                            <span className="text-zinc-400"> from </span>
                            <span className="font-semibold" style={{ color: battle.from_user_color }}>
                              {battle.from_user_name}
                            </span>
                          </p>
                          {isYourLoss && (
                            <div className="mt-1.5 text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 inline-block font-medium">
                              Territory Lost! -{(battle.area_change / 1000000).toFixed(2)} km²
                            </div>
                          )}
                          {isYourCapture && (
                            <div className="mt-1.5 text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 inline-block font-medium">
                              Captured! +{(battle.area_change / 1000000).toFixed(2)} km²
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-zinc-500">
                          {new Date(battle.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {battle.area_change && (
                          <span className="text-xs text-zinc-500">
                            • {(battle.area_change / 1000000).toFixed(2)} km²
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Click indicator */}
                    <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
