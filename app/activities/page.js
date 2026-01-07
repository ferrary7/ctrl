'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ShareButton from '@/components/ShareButton';

export default function Activities() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [availableActivities, setAvailableActivities] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSelection, setShowSelection] = useState(false);
  const [fetchingAvailable, setFetchingAvailable] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      loadActivities();
    }
  }, [status, router]);

  const loadActivities = async () => {
    try {
      const [activitiesRes, territoriesRes] = await Promise.all([
        fetch('/api/activities'),
        fetch('/api/territories')
      ]);
      
      const activitiesData = await activitiesRes.json();
      const territories = await territoriesRes.json();
      
      // Handle different response structures
      let activityList = [];
      if (Array.isArray(activitiesData)) {
        activityList = activitiesData;
      } else if (activitiesData && Array.isArray(activitiesData.activities)) {
        activityList = activitiesData.activities;
      } else if (activitiesData && Array.isArray(activitiesData.data)) {
        activityList = activitiesData.data;
      }
      
      // Map territories to activities
      const territoriesByActivity = {};
      if (Array.isArray(territories)) {
        console.log('Territories:', territories);
        territories.forEach(t => {
          if (t.activity_id) {
            territoriesByActivity[t.activity_id] = t;
          }
        });
      }
      
      console.log('Territory mapping:', territoriesByActivity);
      console.log('Activities:', activityList.map(a => ({ id: a.id, name: a.name })));
      
      // Add territory info to activities
      const enrichedActivities = activityList.map(activity => ({
        ...activity,
        territory: territoriesByActivity[activity.id] || null
      }));
      
      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableActivities = async () => {
    setFetchingAvailable(true);
    try {
      const response = await fetch('/api/strava/activities');
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setAvailableActivities(data);
        // Auto-select the latest activity (first one)
        if (data.length > 0) {
          setSelectedIds([data[0].id]);
        }
        setShowSelection(true);
      } else {
        alert('Failed to fetch activities from Strava');
      }
    } catch (error) {
      console.error('Error fetching available activities:', error);
      alert('Failed to fetch activities from Strava');
    } finally {
      setFetchingAvailable(false);
    }
  };

  const toggleSelection = (id, isLatest) => {
    // Can't deselect the latest activity
    if (isLatest && selectedIds.includes(id)) return;
    
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      // Limit to 3 selections
      if (selectedIds.length < 3) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const syncSelectedActivities = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one activity');
      return;
    }
    
    setSyncing(true);
    try {
      const response = await fetch('/api/activities/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityIds: selectedIds }),
      });
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message || `Synced ${data.count} activities! ${data.territoriesClaimed || 0} territories automatically claimed.`);
        setShowSelection(false);
        setSelectedIds([]);
        setAvailableActivities([]);
        await loadActivities();
      } else {
        alert(data.error || 'Failed to sync activities');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync activities');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-4xl font-bold text-white">Activities</h2>
            {!showSelection && (
              <button
                onClick={fetchAvailableActivities}
                disabled={fetchingAvailable}
                className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-zinc-100 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {fetchingAvailable ? 'Loading...' : 'Sync Activities'}
              </button>
            )}
          </div>

          {/* Activity Selection Modal */}
          {showSelection && (
            <div className="mb-8 p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Choose 3 Activities</h3>
                  <p className="text-sm text-white/70">
                    Latest activity auto-selected. Pick 2 more you're proud of. ({selectedIds.length}/3 selected)
                  </p>
                </div>
                <button
                  onClick={() => setShowSelection(false)}
                  className="text-white/40 hover:text-white/70 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {availableActivities.map((activity, index) => {
                  const isLatest = index === 0;
                  const isSelected = selectedIds.includes(activity.id);
                  
                  return (
                    <div
                      key={activity.id}
                      onClick={() => toggleSelection(activity.id, isLatest)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-white bg-white/10' 
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      } ${isLatest ? 'ring-2 ring-emerald-500/30' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white">{activity.name}</h4>
                            {isLatest && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 mb-3">
                            {new Date(activity.start_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <div className="flex gap-4 text-sm">
                            <span className="text-zinc-400">
                              {(activity.distance / 1000).toFixed(1)} km
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-400 capitalize">{activity.type}</span>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-white bg-white' : 'border-white/40'
                        }`}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={syncSelectedActivities}
                disabled={syncing || selectedIds.length === 0}
                className="w-full px-6 py-3 rounded-full bg-white text-black hover:bg-zinc-100 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? 'Syncing...' : `Sync ${selectedIds.length} Selected ${selectedIds.length === 1 ? 'Activity' : 'Activities'}`}
              </button>
            </div>
          )}

          <div className="mb-8 p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
            <p className="text-sm text-white/70">
              <span className="font-medium text-white">Territory System:</span> Every activity creates territory! Closed loops create full area territories. Self-intersecting routes detect the largest loop inside. Linear routes create 50m corridors on each side. Larger territories win when they overlap.
            </p>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-xl text-zinc-400 mb-4">No activities yet</p>
              <p className="text-zinc-500">Sync your activities to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const territory = activity.territory;
                const territoryType = territory?.territory_type || 'none';
                const territoryIcon = territoryType === 'polygon' ? '🔷' : territoryType === 'loop' ? '🔶' : territoryType === 'corridor' ? '🛣️' : '';
                const territoryLabel = territoryType === 'polygon' ? 'Full Loop' : territoryType === 'loop' ? 'Loop Detected' : territoryType === 'corridor' ? 'Corridor' : 'No Territory';
                const hasTerritory = !!territory;
                
                return (
                  <div
                    key={activity.id}
                    className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-semibold text-white">{activity.name}</h3>
                          {hasTerritory ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                              {territoryIcon}
                              {territoryLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium">
                              📍 No Territory
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-sm">
                          {new Date(activity.started_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <ShareButton activity={activity} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 text-sm mb-3">
                      <div>
                        <span className="text-white/50 block mb-1">Type</span>
                        <p className="font-medium text-white capitalize">{activity.type}</p>
                      </div>
                      <div>
                        <span className="text-white/50 block mb-1">Distance</span>
                        <p className="font-medium text-white">
                          {(activity.distance / 1000).toFixed(2)} km
                        </p>
                      </div>
                      <div>
                        <span className="text-white/50 block mb-1">Duration</span>
                        <p className="font-medium text-white">
                          {Math.floor(activity.duration / 60)} min
                        </p>
                      </div>
                    </div>
                    
                    {territory && (
                      <div className="pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/70">Territory Claimed</span>
                          <span className="font-semibold text-emerald-400">
                            {(territory.area_sqm / 1000000).toFixed(2)} km²
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
