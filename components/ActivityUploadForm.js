'use client';

import { useState } from 'react';
import { uploadActivity } from '@/app/actions';

/**
 * Activity upload form for manual GPS file upload
 */

export default function ActivityUploadForm({ userId, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    
    const formData = new FormData(e.target);
    formData.append('userId', userId);
    
    try {
      const result = await uploadActivity(formData);
      
      if (result.success) {
        onSuccess?.(result.activity);
        e.target.reset();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4">Upload Activity</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Activity Name
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="Morning Run"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Type
          </label>
          <select
            name="type"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="Run">Run</option>
            <option value="Ride">Ride</option>
            <option value="Walk">Walk</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Encoded Polyline
          </label>
          <textarea
            name="polyline"
            required
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
            placeholder="Paste encoded polyline from GPS data..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Distance (m)
            </label>
            <input
              type="number"
              name="distance"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="5000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Duration (s)
            </label>
            <input
              type="number"
              name="duration"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="1800"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Started At
          </label>
          <input
            type="datetime-local"
            name="startedAt"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <input
          type="hidden"
          name="externalId"
          value={`manual_${Date.now()}`}
        />
        
        {error && (
          <div className="p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded text-red-300 text-sm">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          {uploading ? 'Processing...' : 'Upload & Claim Territory'}
        </button>
      </form>
    </div>
  );
}
