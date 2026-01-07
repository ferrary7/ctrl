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
 * Main app page - map-first interface
 */

export default function HomePage() {
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
      if (window.setBattleFeedVisible) window.setBattleFeedVisible(false);
      if (window.closeTerritoryList) window.closeTerritoryList();
    }
  }, []);
  
  // Handler for when battle feed items are clicked
  const handleBattleFeedClick = (territoryData) => {
    // Set the selected territory to show both the info card AND trigger map selection
    setSelectedTerritory(territoryData);
    // Close battle feed and territory list when card opens
    if (typeof window !== 'undefined') {
      if (window.setBattleFeedVisible) window.setBattleFeedVisible(false);
      if (window.closeTerritoryList) window.closeTerritoryList();
    }
  };
  
  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return (
      <div className="min-h-screen bg-black">
        {/* Hero Section */}
        <div className="h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
          {/* Subtle background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-black" />

          <div className="text-center max-w-5xl relative z-10">
            <h1 className="text-6xl md:text-8xl font-semibold tracking-tight text-white mb-8 leading-tight">
              Claim Territory
              <br />
              <span className="text-zinc-400">in Real Life</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-400 mb-16 max-w-3xl mx-auto font-normal leading-relaxed">
              Transform your runs and rides into competitive territory. Claim areas through completed loops, beat others by running bigger routes, and dominate the map.
            </p>
            
            <button
              onClick={() => signIn('strava', { callbackUrl: '/' })}
              className="inline-flex items-center gap-3 bg-white hover:bg-zinc-100 text-black text-base font-medium px-8 py-4 rounded-full transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Connect with Strava
            </button>
            
            <p className="mt-8 text-sm text-zinc-500">
              Free forever · Automatic syncing
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="py-32 px-6 bg-zinc-950">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-semibold text-center mb-32 text-white tracking-tight">
              How It Works
            </h2>
            
            <div className="space-y-32">
              {/* Step 1 */}
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div>
                  <div className="text-sm font-medium text-zinc-500 mb-4 tracking-wider">STEP 01</div>
                  <h3 className="text-4xl font-semibold mb-6 text-white">Sync Your Activities</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Connect your Strava account and all your activities are automatically imported. Every run and ride gets analyzed for territory potential.
                  </p>
                </div>
                <div className="h-80 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-24 h-24 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-zinc-500">Activity syncing</p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div className="order-2 md:order-1 h-80 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-24 h-24 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-zinc-500">Automatic territory detection</p>
                  </div>
                </div>
                <div className="order-1 md:order-2">
                  <div className="text-sm font-medium text-zinc-500 mb-4 tracking-wider">STEP 02</div>
                  <h3 className="text-4xl font-semibold mb-6 text-white">Territory Detection</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Our smart system analyzes every activity. Closed loops become full territories. Self-intersecting routes detect the largest loop. Linear routes create 50m-wide corridors.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div>
                  <div className="text-sm font-medium text-zinc-500 mb-4 tracking-wider">STEP 03</div>
                  <h3 className="text-4xl font-semibold mb-6 text-white">Dominate the Map</h3>
                  <p className="text-xl text-zinc-400 leading-relaxed">
                    Larger territories win when they overlap. Challenge friends, climb the leaderboard, and control more of the map. Your color represents your domain across the globe.
                  </p>
                </div>
                <div className="h-80 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-24 h-24 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20H19a2 2 0 002-2v-2a2 2 0 00-2-2h-2.5a2 2 0 01-1-3.8A6 6 0 006.5 12" />
                    </svg>
                    <p className="text-zinc-500">Territory control</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules Section */}
        <div className="py-32 px-6 bg-black">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-semibold text-center mb-24 text-white tracking-tight">
              The Rules
            </h2>
            
            <div className="space-y-1 divide-y divide-zinc-800">
              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Closed Loops - Full Territory</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  Any activity with start and end points within 100 meters creates a full territory polygon. No self-intersections allowed.
                </p>
              </div>

              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Complex Routes - Largest Loop</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  For routes that cross themselves, our system finds every intersection and extracts the largest valid loop. Get creative with your routes!
                </p>
              </div>

              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Linear Routes - Corridors</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  Straight-line routes create 50-meter corridors on each side of your path. No closed loop needed—every activity claims territory.
                </p>
              </div>

              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Larger Always Wins</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  When territories overlap, the bigger area takes over. It&apos;s not about speed or distance—only the enclosed space matters.
                </p>
              </div>

              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Personal Territory Color</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  Choose your unique territory color in your profile settings. All your territories display in this color on the global map.
                </p>
              </div>

              <div className="py-8">
                <h3 className="text-2xl font-medium mb-3 text-white">Instant Claiming</h3>
                <p className="text-lg text-zinc-400 leading-relaxed">
                  When you sync an activity, its territory is claimed automatically. No waiting, no manual actions—fully automated system.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-32 px-6 bg-zinc-950">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-semibold mb-8 text-white tracking-tight">
              Start Claiming Territory
            </h2>
            <p className="text-xl text-zinc-400 mb-12 leading-relaxed">
              Connect your Strava account and transform your activities into competitive gameplay.
            </p>
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center gap-3 bg-white hover:bg-zinc-100 text-black text-base font-medium px-8 py-4 rounded-full transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Connect with Strava
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-zinc-900 bg-black">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-sm text-zinc-500">© 2026 CTRL. All rights reserved.</p>
          </div>
        </footer>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950">
      {/* Header */}
      <Navbar />
      
      {/* Main content */}
      <div className="flex-1 overflow-hidden p-2 md:p-4 lg:p-8 bg-black">
        <div className="h-full w-full relative rounded-2xl md:rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
          <div style={{ position: 'absolute', inset: 0 }}>
            <TerritoryMap
              onTerritoryClick={handleTerritoryClick}
              userLocation={null}
              externalSelectedTerritory={selectedTerritory}
              activityId={activityId}
              showOnlyActivity={showOnlyActivity}
            />
          </div>
          
          {selectedTerritory && (
            <TerritoryCard
              territory={selectedTerritory}
              onClose={() => setSelectedTerritory(null)}
            />
          )}
          
          {/* Battle Feed - Hide when showing a specific activity */}
          {!activityId && <BattleFeed onTerritoryClick={handleBattleFeedClick} />}
          
          {showLeaderboard && (
            <div className="absolute top-4 right-4 w-96 z-10">
              <Leaderboard limit={10} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
