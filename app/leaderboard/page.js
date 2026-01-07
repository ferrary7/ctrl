'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard?limit=100');
      const data = await response.json();
      console.log('Leaderboard data:', data);
      
      if (Array.isArray(data)) {
        setLeaderboard(data);
      } else {
        console.error('Leaderboard data is not an array:', data);
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-400';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '#1';
    if (rank === 2) return '#2';
    if (rank === 3) return '#3';
    return `#${rank}`;
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <Navbar />

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Global Leaderboard</h1>
          <p className="text-white/70">Top territory controllers worldwide</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-4 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-white/70 uppercase tracking-wider">
                      Territories
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-white/70 uppercase tracking-wider">
                      Total Area
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-white/70 uppercase tracking-wider">
                      Distance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leaderboard.map((entry) => (
                    <tr 
                      key={entry.user_id}
                      className={`
                        hover:bg-white/5 transition-colors
                        ${entry.user_id === session?.user?.id ? 'bg-pink-500/10' : ''}
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-lg font-bold ${getRankColor(entry.rank)}`}>
                          {getRankIcon(entry.rank)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/user/${entry.user_strava_id || entry.user_id}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                          {entry.user_avatar && (
                            <Image 
                              src={entry.user_avatar} 
                              alt={entry.user_name || 'User'}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-white flex items-center gap-2">
                              {entry.user_name || 'Unknown User'}
                              {entry.user_id === session?.user?.id && (
                                <span className="text-xs text-pink-400">(You)</span>
                              )}
                            </div>
                            {entry.user_color && (
                              <div className="flex items-center gap-1 mt-1">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.user_color }}
                                />
                                <span className="text-xs text-white/40">{entry.user_color}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-white">
                          {entry.total_territories || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-white">
                          {entry.total_area_km2 ? entry.total_area_km2.toFixed(3) : '0.000'} km²
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-white/70">
                          {entry.total_distance ? (entry.total_distance / 1000).toFixed(1) : '0'} km
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {leaderboard.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-white/50">No territories claimed yet. Be the first!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
