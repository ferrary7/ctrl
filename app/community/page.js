'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function CommunityPage() {
  const { data: session } = useSession();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/community');
        const data = await res.json();
        setPlayers(data || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch community:', error);
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-400">Please sign in to view the community</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <Navbar />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-semibold text-white mb-4 tracking-tight">
            Community
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            <p className="text-zinc-400 mt-4">Loading players...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-2xl font-semibold text-white mb-2">No other players yet</h2>
            <p className="text-zinc-400 mb-6">You're the first one here! Share the app with your running friends.</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-auto text-left">
              <h3 className="text-lg font-semibold text-white mb-3">Invite Friends</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Share your referral link with other Strava users to start competing:
              </p>
              <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 font-mono text-sm text-zinc-300 break-all">
                {typeof window !== 'undefined' ? window.location.origin : 'Loading...'}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-2">
                {players.length} {players.length === 1 ? 'Player' : 'Players'}
              </h2>
              <p className="text-zinc-400">All active territory controllers</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {players.map((player, index) => (
                <Link
                  key={player.id}
                  href={`/user/${player.strava_id || player.id}`}
                  className={`bg-white/5 backdrop-blur border rounded-xl p-6 transition-all hover:border-white/20 ${
                    player.isYou ? 'border-pink-500/50 bg-pink-950/20' : 'border-white/10'
                  }`}
                >
                  {/* Rank Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: player.color }}
                    >
                      #{index + 1}
                    </div>
                    {player.isYou && (
                      <span className="bg-pink-500/20 text-pink-400 text-xs font-semibold px-2 py-1 rounded-full">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white mb-1 hover:text-white/80 transition-colors">{player.name}</h3>
                    {player.lastActive && (
                      <p className="text-xs text-white/50">
                        Last active {new Date(player.lastActive).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-white/50 mb-1">Territories</p>
                      <p className="text-xl font-bold text-white">{player.territories}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-white/50 mb-1">Total Area</p>
                      <p className="text-xl font-bold text-white">{player.area.toFixed(2)}</p>
                      <p className="text-xs text-white/50">km²</p>
                    </div>
                  </div>

                  {/* Show Profile Button */}
                  <div className="mb-4">
                    <button
                      className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-all"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/user/${player.strava_id || player.id}`;
                      }}
                    >
                      View Profile
                    </button>
                  </div>

                  {/* Color indicator */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="text-xs text-white/50">Map Color</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
