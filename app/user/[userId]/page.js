'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

export default function PublicProfilePage() {
  const { userId } = useParams(); // This is actually stravaId
  const { data: session } = useSession();
  const router = useRouter();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('territories');

  useEffect(() => {
    // If viewing own profile, redirect to /profile
    if (session?.user?.stravaId && userId === session.user.stravaId) {
      router.push('/profile');
      return;
    }
    
    if (userId) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, session, router]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/user/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      } else {
        console.error('Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-2">User not found</h2>
            <p className="text-zinc-400 mb-6">This user doesn&apos;t exist</p>
            <Link
              href="/community"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              ← Back to Community
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { user, stats, territories = [], activities = [] } = profileData;

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            {user?.avatar && (
              <div className="relative">
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-2xl ring-2 ring-white/10"
                />
                {user.color && (
                  <div
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full ring-4 ring-black"
                    style={{ backgroundColor: user.color }}
                  />
                )}
              </div>
            )}

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-white mb-2">{user?.name}</h1>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
                <span>Strava Athlete</span>
                {user?.joinedAt && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>Joined {new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </>
                )}
              </div>
            </div>

            {/* Share Button */}
            <button
              onClick={() => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/user/${userId}`;
                if (navigator.share) {
                  navigator.share({
                    title: `${user?.name}'s Territory`,
                    text: `Check out ${user?.name}'s territories on CTRL!`,
                    url: url,
                  });
                } else {
                  navigator.clipboard.writeText(url);
                  alert('Profile link copied to clipboard!');
                }
              }}
              className="text-sm text-white/70 hover:text-white px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>

          {/* Stats Grid */}
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {stats.rank ? `#${stats.rank}` : '-'}
                </div>
                <div className="text-xs text-white/50">Global Rank</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {stats.totalTerritories || 0}
                </div>
                <div className="text-xs text-white/50">Territories</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {typeof stats.totalArea === 'number' ? stats.totalArea.toFixed(2) : '0.00'}
                </div>
                <div className="text-xs text-white/50">km²</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {typeof stats.totalDistance === 'number' ? (stats.totalDistance / 1000).toFixed(0) : '0'}
                </div>
                <div className="text-xs text-white/50">km Distance</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <div className="text-2xl font-semibold text-white mb-1">-</div>
                <div className="text-xs text-white/50">Global Rank</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">0</div>
                <div className="text-xs text-white/50">Territories</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">0.00</div>
                <div className="text-xs text-white/50">km²</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white mb-1">0</div>
                <div className="text-xs text-white/50">km Distance</div>
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
            Territories ({territories?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`text-sm px-4 py-2 rounded-lg transition-all ${
              activeTab === 'activities'
                ? 'text-white bg-white/10'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Activities ({activities?.length || 0})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'territories' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!territories || territories.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-4xl mb-3">🗺️</div>
                <p className="text-white/50">No territories yet</p>
              </div>
            ) : (
              territories.map((territory) => (
                <div
                  key={territory.id}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ backgroundColor: user?.color || '#FF1493' }}
                    />
                    <div className="text-xs text-white/50">
                      {new Date(territory.captured_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-white mb-1">
                    Territory #{territory.id.slice(0, 8)}
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
          <div className="space-y-3">
            {!activities || activities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🏃</div>
                <p className="text-white/50">No activities yet</p>
              </div>
            ) : (
              activities.map((activity) => (
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
      </div>
    </div>
  );
}
