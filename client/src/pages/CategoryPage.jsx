import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';

const CategoryPage = () => {
  const { name } = useParams();
  
  // Cleanest way: Redirect to Browse with the genre filter pre-selected
  // This keeps all filtering/sorting logic centralized in a single professional view
  return <Navigate to={`/browse?category=${encodeURIComponent(name)}`} replace />;
};

export default CategoryPage;
