'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import TerritoryMap from '@/components/TerritoryMap';
import Leaderboard from '@/components/Leaderboard';
import TerritoryCard from '@/components/TerritoryCard';
import BattleFeed from '@/components/BattleFeed';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

/**
 * Home page content - contains client-side logic and useSearchParams
 */

export default function HomePageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const activityId = searchParams.get('activity');
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [mapRef, setMapRef] = useState(null);
  const [showOnlyActivity, setShowOnlyActivity] = useState(!!activityId);
  
  // Expose close territory card function to window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.closeTerritoryCard = () => setSelectedTerritory(null);
      return () => {
        delete window.closeTerritoryCard;
      };
    }
  }, []);
  
  // Handler for when territories are clicked (memoized to prevent infinite loops)
  const handleTerritoryClick = useCallback((territory) => {
    setSelectedTerritory(territory);
    // Close battle feed and territory list when card opens
    if (typeof window !== 'undefined') {
      window.closeBattleFeed?.();
      window.closeTerritoryList?.();
    }
  }, []);

  // If not logged in, show landing page
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black">
        <Navbar />

        {/* Hero Section */}
        <div className="min-h-screen flex items-center relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 relative z-10">
            <div className="max-w-3xl">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
                Transform Your Runs and Rides Into Territory
              </h1>
              <p className="text-xl sm:text-2xl text-zinc-300 mb-8 max-w-2xl leading-relaxed">
                Transform your runs and rides into competitive territory. Claim areas through completed loops, beat others by running bigger routes, and dominate the map.
              </p>

              <button
                onClick={() => signIn('strava', { redirect: false })}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-zinc-100 transition-all text-lg"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
                Sign In with Strava
              </button>

              <p className="text-zinc-500 mt-6 text-sm">No account needed. We only read your public activity data.</p>
            </div>
          </div>

          {/* Background accent */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl"></div>
            <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl"></div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="bg-black/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-16 text-center tracking-tight">How It Works</h2>

            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="text-5xl mb-6">🕐</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Sync Your Activities</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  Connect your Strava account to automatically sync all your runs and rides into the system.
                </p>
              </div>

              <div className="text-center">
                <div className="text-5xl mb-6">✓</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Territory Detection</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  We analyze each activity to detect territories. Closed loops become full area territories. Self-intersecting routes extract the largest loop. Linear routes create 50m corridors on each side.
                </p>
              </div>

              <div className="text-center">
                <div className="text-5xl mb-6">🗺️</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Dominate the Map</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  Watch your territories appear on the global map in your custom color. Challenge other runners and cyclists in your area.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules Section */}
        <div className="bg-gradient-to-b from-black/50 to-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-16 text-center tracking-tight">The Rules</h2>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Closed Loops - Full Territory</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Complete a closed loop where your start and end points are within 100 meters, and the entire enclosed area becomes your territory.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Complex Routes - Largest Loop</h3>
                <p className="text-zinc-400 leading-relaxed">
                  For self-intersecting routes, we automatically detect and claim only the largest enclosed loop within your activity path.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Linear Routes - Corridors</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Point-to-point routes create territorial corridors. A 50-meter buffer extends on each side of your path.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Larger Always Wins</h3>
                <p className="text-zinc-400 leading-relaxed">
                  When territories overlap, the bigger area takes over. It&apos;s not about speed or distance—only the enclosed space matters.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Personal Territory Color</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Choose your unique territory color in your profile settings. All your territories display in this color on the global map.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-3">Instant Claiming</h3>
                <p className="text-zinc-400 leading-relaxed">
                  The moment you complete an activity, territories are automatically detected and claimed. No manual approval needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in - show map interface
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      <div className="h-[calc(100vh-56px)] flex flex-col md:flex-row relative">
        {/* Main Map Area */}
        <div className="flex-1 relative">
          <TerritoryMap
            ref={setMapRef}
            onTerritoryClick={handleTerritoryClick}
            selectedTerritoryId={selectedTerritory?.id}
            activityId={activityId}
          />
        </div>

        {/* Right Sidebar - Toggleable Panels */}
        <div className="hidden md:flex md:w-96 flex-col bg-black/80 border-l border-white/10 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10 bg-black/50">
            <button
              onClick={() => setShowLeaderboard(false)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                !showLeaderboard ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white'
              }`}
            >
              Battle Feed
            </button>
            <button
              onClick={() => setShowLeaderboard(true)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                showLeaderboard ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {showLeaderboard ? <Leaderboard /> : <BattleFeed onTerritorySelect={handleTerritoryClick} />}
          </div>
        </div>
      </div>

      {/* Territory Card Modal */}
      {selectedTerritory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <TerritoryCard
            territory={selectedTerritory}
            onClose={() => setSelectedTerritory(null)}
          />
        </div>
      )}
    </div>
  );
}
