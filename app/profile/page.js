'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#FF1493');
  const [activeTab, setActiveTab] = useState('territories');

  const popularColors = [
    { name: 'Hot Pink', color: '#FF1493' },
    { name: 'Electric Purple', color: '#9D00FF' },
    { name: 'Cyber Blue', color: '#00D9FF' },
    { name: 'Neon Green', color: '#39FF14' },
    { name: 'Sunset Orange', color: '#FF6600' },
    { name: 'Crimson Red', color: '#DC143C' },
    { name: 'Gold', color: '#FFD700' },
    { name: 'Teal', color: '#00CED1' },
    { name: 'Lime', color: '#32CD32' },
    { name: 'Magenta', color: '#FF00FF' },
    { name: 'Sky Blue', color: '#87CEEB' },
    { name: 'Coral', color: '#FF7F50' },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      loadUserData();
      loadProfileData();
    }
  }, [status, router]);

  const loadUserData = async () => {
    try {
      const response = await fetch('/api/user/profile');
      const data = await response.json();
      setUserData(data);
      if (data.color) {
        setSelectedColor(data.color);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileData = async () => {
    try {
      // Fetch profile data using the session's strava ID
      const response = await fetch(`/api/user/${session?.user?.stravaId}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  const saveColor = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: selectedColor }),
      });

      if (response.ok) {
        alert('Territory color updated! 🎨');
        await loadUserData();
      } else {
        alert('Failed to update color');
      }
    } catch (error) {
      console.error('Error saving color:', error);
      alert('Failed to update color');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16">
        {/* Profile Header */}
        <div className="mb-16">
          <div className="flex items-start gap-8 mb-12">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name}
                className="w-24 h-24 rounded-2xl border border-zinc-800"
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-semibold mb-2 text-white tracking-tight">{session?.user?.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-sm text-zinc-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                  </svg>
                  Connected
                </span>
              </div>
              {userData?.strava_id && (
                <p className="text-sm text-zinc-500">Athlete ID: {userData.strava_id}</p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          {userData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="text-3xl font-semibold text-white mb-1">
                  {userData.total_territories || 0}
                </div>
                <div className="text-sm text-zinc-500">Territories</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="text-3xl font-semibold text-white mb-1">
                  {((userData.total_area_sqm || 0) / 1000000).toFixed(2)}
                </div>
                <div className="text-sm text-zinc-500">km² Owned</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="text-3xl font-semibold text-white mb-1">
                  {((userData.total_distance || 0) / 1000).toFixed(0)}
                </div>
                <div className="text-sm text-zinc-500">km Total</div>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="text-3xl font-semibold text-white mb-1">
                  #{userData.rank || '-'}
                </div>
                <div className="text-sm text-zinc-500">Rank</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('territories')}
            className={`text-sm px-4 py-2 rounded-lg transition-all ${
              activeTab === 'territories'
                ? 'text-white bg-white/10'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Territories ({profileData?.territories?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`text-sm px-4 py-2 rounded-lg transition-all ${
              activeTab === 'activities'
                ? 'text-white bg-white/10'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Activities ({profileData?.activities?.length || 0})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'territories' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-16">
            {!profileData?.territories || profileData.territories.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-4xl mb-3">🗺️</div>
                <p className="text-white/50">No territories yet</p>
              </div>
            ) : (
              profileData.territories.map((territory) => (
                <div
                  key={territory.id}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ backgroundColor: userData?.color || '#FF1493' }}
                    />
                    <div className="text-xs text-white/50">
                      {new Date(territory.captured_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-white mb-1">
                    {territory.name || `Territory #${territory.id.slice(0, 8)}`}
                  </div>
                  <div className="text-xs text-white/50">
                    {((territory.area_sqm || 0) / 1000000).toFixed(3)} km²
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-3 mb-16">
            {!profileData?.activities || profileData.activities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🏃</div>
                <p className="text-white/50">No activities yet</p>
              </div>
            ) : (
              profileData.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white mb-1">
                        {activity.name}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/50">
                        <span>{((activity.distance || 0) / 1000).toFixed(2)} km</span>
                        <span>•</span>
                        <span>{new Date(activity.started_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-xs text-white/40">
                      {activity.type}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Color Picker Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-semibold mb-3 text-white tracking-tight">Territory Color</h2>
          <p className="text-zinc-400 mb-8 text-lg">
            Choose the color that represents your territories on the map.
          </p>

          <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 mb-6">
            {/* Current Color Display */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div 
                  className="w-20 h-20 rounded-2xl border border-zinc-800 shadow-lg transition-all"
                  style={{ backgroundColor: selectedColor }}
                />
                <div>
                  <div className="text-sm text-zinc-500 mb-1">Selected Color</div>
                  <div className="text-2xl font-mono font-semibold text-white">{selectedColor}</div>
                </div>
              </div>
            </div>

            {/* Color Input */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-zinc-500 mb-3">Hex Color Code</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 px-5 py-4 rounded-xl bg-black/50 border border-zinc-800 focus:border-zinc-600 focus:outline-none text-white font-mono text-lg transition-all"
                  />
                  <div className="relative">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button className="px-6 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium transition-all">
                      Choose
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Select */}
              <div>
                <label className="block text-sm text-zinc-500 mb-3">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {popularColors.map((item) => (
                    <button
                      key={item.color}
                      onClick={() => setSelectedColor(item.color)}
                      className={`group relative px-4 py-2 rounded-lg border transition-all ${
                        selectedColor === item.color 
                          ? 'border-zinc-600 bg-zinc-800' 
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-zinc-700"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className={`text-sm ${
                          selectedColor === item.color ? 'text-white' : 'text-zinc-400'
                        }`}>
                          {item.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveColor}
            disabled={saving || selectedColor === userData?.color}
            className="w-full py-4 rounded-full bg-white hover:bg-zinc-100 text-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {saving ? 'Saving...' : selectedColor === userData?.color ? 'Current Color' : 'Save Territory Color'}
          </button>
        </div>

        {/* Account Info */}
        <div>
          <h2 className="text-3xl font-semibold mb-8 text-white tracking-tight">Account</h2>
          <div className="space-y-1 divide-y divide-zinc-800 mb-8">
            <div className="flex justify-between py-4">
              <span className="text-zinc-400">Email</span>
              <span className="font-medium text-white">{session?.user?.email || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-zinc-400">Strava ID</span>
              <span className="font-medium text-white">{userData?.strava_id || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-zinc-400">Member Since</span>
              <span className="font-medium text-white">
                {userData?.created_at ? new Date(userData.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-4">
              <span className="text-zinc-400">Last Activity</span>
              <span className="font-medium text-white">
                {userData?.last_activity_at 
                  ? new Date(userData.last_activity_at).toLocaleDateString() 
                  : 'No activities yet'}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push('/api/auth/signout')}
            className="w-full py-3 rounded-full border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
