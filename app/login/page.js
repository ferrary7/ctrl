'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            CTRL
          </h1>
          <p className="text-gray-400 text-sm">
            Claim Territory in Real Life
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
            <p className="text-sm">
              {error === 'OAuthCallback' && 'There was an error connecting to Strava. Please try again.'}
              {error === 'OAuthSignin' && 'Error starting the Strava sign in process.'}
              {error === 'Callback' && 'Error handling the sign in callback.'}
              {!['OAuthCallback', 'OAuthSignin', 'Callback'].includes(error) && 'Authentication error. Please try again.'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => signIn('strava', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Connect with Strava
          </button>

          <p className="text-xs text-gray-400 text-center">
            By connecting, you agree to share your activity data with CTRL to calculate territory ownership.
          </p>
        </div>

        <div className="pt-6 border-t border-gray-700">
          <h2 className="text-sm font-semibold text-white mb-3">How it works:</h2>
          <ul className="space-y-2 text-xs text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">▸</span>
              <span>Connect your Strava account to import activities</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">▸</span>
              <span>Your routes automatically claim territory on the map</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">▸</span>
              <span>Compete with others to control the most area</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
