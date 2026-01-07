'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function LoginContent() {
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

        <button
          onClick={() => signIn('strava', { callbackUrl })}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
        >
          <svg className="w-5 h-5 inline mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
          </svg>
          Sign In with Strava
        </button>

        <p className="text-center text-sm text-gray-400">
          Redirecting to: <span className="text-gray-300">{callbackUrl === '/' ? 'Home' : callbackUrl}</span>
        </p>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            We only read your public activity data. Your password is never stored.
          </p>
        </div>
      </div>
    </div>
  );
}
