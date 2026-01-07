'use client';

import { useState } from 'react';

export default function ShareButton({ activity, territory, user }) {
  const [copied, setCopied] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    if (activity?.id) return `${base}/?activity=${activity.id}`;
    if (territory?.id) return `${base}/?territory=${territory.id}`;
    return base;
  };

  const getShareText = () => {
    if (activity) {
      return `Just completed a ${activity.type || 'workout'} on CTRL! 🏃\n${(activity.distance / 1000).toFixed(2)}km\n\nCheck out my territories and compete with me!`;
    }
    if (territory) {
      return `I just claimed a new territory on CTRL! 🗺️\n${((territory.area_sqm || 0) / 1000000).toFixed(3)}km²\n\nCompete with me and take over!`;
    }
    return 'Check out CTRL - the territory capture game for runners and cyclists!';
  };

  const handleShare = async () => {
    const url = getShareUrl();
    const text = getShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CTRL - Territory Conquest',
          text: text,
          url: url,
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      navigator.clipboard.writeText(`${text}\n\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSocialShare = (platform) => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    let shareUrl;

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      default:
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  if (!activity && !territory) return null;

  return (
    <div className="relative">
      {/* Main Share Button */}
      <button
        onClick={handleShare}
        onMouseEnter={() => setShowSocial(true)}
        onMouseLeave={() => setShowSocial(false)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white transition-all text-xs md:text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {copied ? 'Copied!' : 'Share'}
      </button>

      {/* Social Media Popover (Desktop) */}
      {showSocial && (
        <div className="absolute top-full mt-2 left-0 bg-black/95 backdrop-blur border border-white/10 rounded-lg p-2 shadow-lg z-50 hidden lg:flex gap-2">
          <button
            onClick={() => {
              handleSocialShare('twitter');
              setShowSocial(false);
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/70 hover:text-white"
            title="Share on Twitter"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7a10.6 10.6 0 01-10 5.5z"/>
            </svg>
          </button>
          <button
            onClick={() => {
              handleSocialShare('facebook');
              setShowSocial(false);
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/70 hover:text-white"
            title="Share on Facebook"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 2h-3a6 6 0 00-6 6v3H7v4h2v8h4v-8h3l1-4h-4V8a2 2 0 012-2h3z"/>
            </svg>
          </button>
          <button
            onClick={() => {
              handleSocialShare('whatsapp');
              setShowSocial(false);
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/70 hover:text-white"
            title="Share on WhatsApp"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.288-4.917 5.645-4.917 9.117 0 1.585.292 3.131.843 4.608L2.5 22l4.968-1.3a9.86 9.86 0 004.654 1.185h.005c5.487 0 9.963-4.473 9.963-9.963 0-2.65-.997-5.151-2.809-7.031-1.812-1.88-4.217-2.914-6.76-2.914z"/>
            </svg>
          </button>
          <button
            onClick={() => {
              handleSocialShare('linkedin');
              setShowSocial(false);
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/70 hover:text-white"
            title="Share on LinkedIn"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
