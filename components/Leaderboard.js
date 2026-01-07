'use client';

import Image from 'next/image';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

/**
 * Leaderboard component showing top territory holders
 */

export default function Leaderboard({ limit = 10 }) {
  const { data: leaderboard, error } = useSWR(
    `/api/leaderboard?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false
    }
  );
  
  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <p className="text-red-400">Failed to load leaderboard</p>
      </div>
    );
  }
  
  if (!leaderboard) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="animate-pulse space-y-3">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Top Territory Holders</h2>
      </div>
      
      <div className="divide-y divide-gray-800">
        {leaderboard.map((entry) => (
          <div
            key={entry.userId}
            className="px-4 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 text-center">
                <span className={`text-sm font-bold ${
                  entry.rank === 1 ? 'text-yellow-400' :
                  entry.rank === 2 ? 'text-gray-300' :
                  entry.rank === 3 ? 'text-orange-400' :
                  'text-gray-500'
                }`}>
                  #{entry.rank}
                </span>
              </div>
              
              {entry.avatarUrl && (
                <Image
                  src={entry.avatarUrl}
                  alt={entry.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full"
                />
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {entry.name}
                </p>
                <p className="text-xs text-gray-400">
                  {entry.territoryCount} territories
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {entry.totalAreaSqKm.toFixed(2)} km²
                </p>
                <p className="text-xs text-gray-400">
                  {entry.activityCount} activities
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
