import React from 'react';
import { Info, Copy } from 'lucide-react';

const ListingQualityCard = ({ listing, onFixQuality }) => {
  const getQualityBadge = () => {
    const status = listing.qualityStatus || 'GOOD';
    switch (status) {
      case 'EXCELLENT':
        return { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Excellent' };
      case 'GOOD':
        return { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30', label: 'Good' };
      case 'NEEDS_IMPROVEMENT':
        return { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Needs Polish' };
      default:
        return { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', label: 'Incomplete' };
    }
  };

  const badge = getQualityBadge();

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4.5 hover:border-slate-700 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex gap-3">
            {listing.cover_image || listing.coverImage ? (
              <img 
                src={listing.cover_image || listing.coverImage} 
                alt={listing.title} 
                className="w-14 h-18 object-cover rounded-lg border border-slate-800 flex-shrink-0 bg-slate-800"
              />
            ) : (
              <div className="w-14 h-18 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-500 flex-shrink-0">
                No Cover
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-white line-clamp-1">{listing.title}</h4>
              <p className="text-xs text-slate-400">{listing.author || 'Unknown Author'}</p>
              <p className="text-xs text-indigo-400 font-medium mt-1">₹{listing.price}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
              {badge.label} ({listing.qualityScore || 0}%)
            </span>
          </div>
        </div>

        {/* Duplicate warning flag */}
        {listing.isDuplicateSuspect && (
          <div className="mb-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Potential duplicate listing detected in your bookshelf.</span>
          </div>
        )}

        {/* Actionable Suggestions / Issues */}
        {listing.suggestions && listing.suggestions.length > 0 && (
          <div className="space-y-1 mb-3">
            {listing.suggestions.slice(0, 2).map((sug, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-800/50 px-2.5 py-1 rounded">
                <Info className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span className="line-clamp-1">{sug}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onFixQuality && (
        <button
          onClick={() => onFixQuality(listing)}
          className="w-full mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition-colors text-center"
        >
          Optimize Listing
        </button>
      )}
    </div>
  );
};

export default ListingQualityCard;
