import { Suspense } from 'react';
import LoginContent from '@/components/LoginContent';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600 mb-4" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
