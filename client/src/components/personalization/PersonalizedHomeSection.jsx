import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Compass, Tag, TrendingUp, Users, ChevronRight, Star } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const SECTION_CONFIGS = {
  forYou: {
    title: 'Recommended For You',
    subtitle: 'Curated based on your interaction history and reading preferences',
    icon: <Sparkles className="w-5 h-5 text-amber-500" />,
    accent: 'from-amber-500/10 to-orange-500/10 border-amber-200'
  },
  continueExploring: {
    title: 'Continue Exploring',
    subtitle: 'Pick up where you left off from your recently viewed listings',
    icon: <Compass className="w-5 h-5 text-blue-500" />,
    accent: 'from-blue-500/10 to-indigo-500/10 border-blue-200'
  },
  affordablePicks: {
    title: 'Affordable Student Picks',
    subtitle: 'Top-rated textbooks priced under ₹350 for peer campus learning',
    icon: <Tag className="w-5 h-5 text-emerald-500" />,
    accent: 'from-emerald-500/10 to-teal-500/10 border-emerald-200'
  },
  trendingOnCampus: {
    title: 'Trending on Campus',
    subtitle: 'High-velocity semester textbooks popular among verified students',
    icon: <TrendingUp className="w-5 h-5 text-purple-500" />,
    accent: 'from-purple-500/10 to-pink-500/10 border-purple-200'
  },
  newFromFollowedSellers: {
    title: 'From Sellers You Follow',
    subtitle: 'Fresh listings from your trusted campus book merchants',
    icon: <Users className="w-5 h-5 text-rose-500" />,
    accent: 'from-rose-500/10 to-red-500/10 border-rose-200'
  }
};

const PersonalizedHomeSection = ({ type = 'forYou', books = [] }) => {
  if (!books || books.length === 0) return null;

  const config = SECTION_CONFIGS[type] || SECTION_CONFIGS.forYou;

  return (
    <section className="my-12 text-left animate-in fade-in duration-300">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
            {config.icon}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {config.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {config.subtitle}
            </p>
          </div>
        </div>

        <Link
          to="/browse"
          className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 self-start sm:self-center"
        >
          <span>View Catalog</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Grid of Books */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {books.map((b) => (
          <Link
            key={b.id}
            to={`/book/${b.id}`}
            className="group bg-white rounded-3xl p-3 border border-slate-200/80 shadow-soft hover:shadow-md hover:border-primary-200 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-100 mb-2.5 relative">
                <img
                  src={b.cover_image}
                  alt={b.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300'; }}
                />
                {b.recommendationReason && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-lg truncate text-center">
                    {b.recommendationReason}
                  </div>
                )}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                {b.genre}
              </span>
              <h3 className="text-xs font-black text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                {b.title}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                by {b.author}
              </p>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">
                {formatCurrency(b.price)}
              </span>
              <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                <Star size={10} className="fill-amber-500 text-amber-500" />
                <span>{b.rating || '4.8'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default PersonalizedHomeSection;
