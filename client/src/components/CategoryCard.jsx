import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

const CategoryCard = ({ category }) => {
  // Dynamically get the icon from Lucide
  const Icon = Icons[category.icon] || Icons.Book;

  return (
    <Link 
      to={`/browse?genre=${category.name}`}
      className="group p-6 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-primary-600 hover:border-primary-600 hover:shadow-xl hover:shadow-primary-100 transition-all duration-300"
    >
      <div className="mb-4 p-4 bg-primary-50 rounded-2xl group-hover:bg-white/20 transition-colors">
        <Icon className="w-8 h-8 text-primary-600 group-hover:text-white transition-colors" />
      </div>
      <h3 className="font-bold text-slate-800 group-hover:text-white transition-colors">{category.name}</h3>
      <p className="text-xs text-slate-400 group-hover:text-white/70 mt-1">Explore Books</p>
    </Link>
  );
};

export default CategoryCard;
