'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { categoriesApi, Category, getImageUrl } from '@/lib/api';

export default function AllCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesApi.getAllWithDetails();
      // Filter only active categories
      const activeCategories = data.filter(cat => cat.status === 'ACTIVE');
      setCategories(activeCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    const encodedName = encodeURIComponent(categoryName.toLowerCase().replace(/\s+/g, '-'));
    router.push(`/category/${encodedName}?id=${categoryId}`);
  };

  return (
    <>
      <SEOHead 
        title="All Categories - Quizlogy"
        description="Browse all quiz categories and find contests that interest you"
      />
      <div className="min-h-screen bg-[#0D0009]">
        <DashboardNav />
        
        <div className="container mx-auto px-2 py-4 sm:py-8 sm:px-6 lg:px-4">
          {/* Header */}
          <div className="mb-4 sm:mb-8">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#FFF6D9] mb-1 sm:mb-2">
              All Categories
            </h1>
            <p className="text-[#FFF6D9]/80 text-xs sm:text-sm">
              Explore our wide range of quiz categories
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="relative w-full max-w-[450px]">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  style={{ color: '#9696A3' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search for topics you like"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 sm:h-10 md:h-[40px] rounded-lg sm:rounded-[10px] bg-[#FFF6D9] text-[#9696A3] placeholder:text-[#9696A3]/70 pl-10 sm:pl-12 pr-3 sm:pr-4 border-none outline-none text-sm sm:text-base focus:outline-none"
                style={{
                  paddingLeft: '40px'
                }}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFF6D9]"></div>
            </div>
          )}

          {/* Categories Grid */}
          {!loading && (
            <>
              {filteredCategories.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-[#FFF6D9]/60 text-lg">
                    {searchQuery ? 'No categories found matching your search.' : 'No categories available.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 justify-items-center">
                  {filteredCategories.map((category) => {
                    const imageUrl = category.imageUrl || getImageUrl(category.imagePath || category.image || '');
                    const backgroundColor = category.backgroundColor || '#FFFFFF';
                    
                    return (
                      <div
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id, category.name)}
                        className="group cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full max-w-[140px]"
                      >
                        <div
                          className="flex flex-col items-center justify-center text-center mx-auto"
                          style={{
                            backgroundColor: backgroundColor,
                            width: '100%',
                            maxWidth: '140px',
                            aspectRatio: '140/120',
                            borderRadius: '15px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            padding: '8px'
                          }}
                        >
                          {/* Category Icon/Image */}
                          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mb-2 sm:mb-3 flex items-center justify-center flex-shrink-0">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={category.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-[#0D0009]/10 rounded-full flex items-center justify-center">
                                <span className="text-lg sm:text-xl font-bold text-[#0D0009]/30">
                                  {category.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Category Name */}
                          <h3 className="text-xs sm:text-sm font-semibold text-[#0D0009] leading-tight px-1">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
