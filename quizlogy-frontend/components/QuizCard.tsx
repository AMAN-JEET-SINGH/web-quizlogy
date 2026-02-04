'use client';

import { useState } from 'react';
import { getImageUrl } from '@/lib/api';
interface QuizCardProps {
  id: string;
  name: string;
  contestImage?: string;
  category: string;
  categoryBackgroundColor?: string | null;
  onCardClick?: () => void;
}

// Icon mapping based on category/name
const getQuizIcon = (name: string, category: string) => {
  const lowerName = name.toLowerCase();
  const lowerCategory = category.toLowerCase();

  // Cricket Quiz
  if (lowerName.includes('cricket') || lowerCategory.includes('cricket')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Cricket Bat */}
        <div className="absolute w-12 h-3 bg-yellow-400 rounded transform rotate-[25deg] -translate-x-2"></div>
        <div className="absolute w-10 h-2 bg-yellow-500 rounded transform rotate-[25deg] -translate-x-1 translate-y-1"></div>
        {/* Cricket Ball */}
        <div className="absolute w-4 h-4 bg-orange-500 rounded-full -translate-x-6 -translate-y-2 border border-orange-600">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // History Quiz / General Knowledge
  if (lowerName.includes('history') || lowerName.includes('general') || lowerCategory.includes('history') || lowerCategory.includes('general')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Scroll */}
        <div className="w-16 h-20 bg-yellow-400 rounded-lg relative">
          <div className="absolute top-2 left-2 right-2 space-y-1">
            <div className="h-1 bg-yellow-600 rounded"></div>
            <div className="h-1 bg-yellow-600 rounded w-3/4"></div>
            <div className="h-1 bg-yellow-600 rounded"></div>
            <div className="h-1 bg-yellow-600 rounded w-2/3"></div>
          </div>
          {/* Clock */}
          <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-red-500 rounded-full flex items-center justify-center">
            <div className="absolute w-0.5 h-2 bg-black -translate-y-1"></div>
            <div className="absolute w-2 h-0.5 bg-black translate-x-1"></div>
          </div>
        </div>
      </div>
    );
  }

  // Image Quiz
  if (lowerName.includes('image') || lowerCategory.includes('image')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Image Frame */}
        <div className="w-16 h-16 bg-blue-500 rounded relative border-2 border-blue-400">
          {/* Landscape */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-green-500 rounded-b">
            <div className="absolute top-0 left-1/4 w-8 h-8 bg-green-600 rounded-full -translate-y-1/2"></div>
            <div className="absolute top-0 right-1/4 w-6 h-6 bg-green-600 rounded-full -translate-y-1/2"></div>
          </div>
          {/* Sun */}
          <div className="absolute top-2 right-2 w-4 h-4 bg-yellow-300 rounded-full"></div>
          {/* Corner Handles */}
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-300 rounded border border-blue-400"></div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-300 rounded border border-blue-400"></div>
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-300 rounded border border-blue-400"></div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-300 rounded border border-blue-400"></div>
        </div>
      </div>
    );
  }

  // Brain Test
  if (lowerName.includes('brain') || lowerCategory.includes('brain')) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Brain */}
        <div className="relative w-16 h-14">
          <div className="absolute top-0 left-2 w-8 h-6 bg-blue-500 rounded-full"></div>
          <div className="absolute top-1 right-2 w-7 h-5 bg-green-500 rounded-full"></div>
          <div className="absolute bottom-2 left-4 w-6 h-5 bg-yellow-400 rounded-full"></div>
          <div className="absolute bottom-1 right-4 w-5 h-4 bg-red-500 rounded-full"></div>
          <div className="absolute top-3 left-6 w-4 h-3 bg-purple-500 rounded-full"></div>
        </div>
      </div>
    );
  }

  // Default icon
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
        <span className="text-white text-2xl font-bold">?</span>
      </div>
    </div>
  );
};

export const QuizCard = ({ id, name, contestImage, category, categoryBackgroundColor, onCardClick }: QuizCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  return (
    <div
      className="relative bg-[#0D0009] rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-lg"
      onClick={onCardClick}
      style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}
    >
      {/* Favorite Icon */}
      <button
        onClick={handleFavoriteClick}
        className="absolute top-2 right-2 rounded-full bg-[#FFF6D9] z-10 p-1 hover:scale-110 transition-transform"
      >
        {isFavorited ? (
          <svg
            className="w-3 h-3 fill-red-500"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        ) : (
          <svg
            className="w-3 h-3 stroke-[#2C2159] fill-none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        )}
      </button>

      {/* Icon/Image Area */}
      <div 
        className="h-25 p-4 mt-4 flex items-center justify-center"
        style={{
          backgroundColor: categoryBackgroundColor || undefined
        }}
      >
        {contestImage ? (
          <img
            src={getImageUrl(contestImage)}
            alt={name}
            className="w-full h-full object-contain"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
              const filename = contestImage;
              
              // Prevent infinite loop - check if we've already tried both folders
              const hasTriedCategories = img.dataset.triedCategories === 'true';
              const hasTriedContests = img.dataset.triedContests === 'true';
              
              // If first attempt failed and it's just a filename, try the other folder
              if (!filename.includes('/')) {
                if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                  // First try was contests, now try categories
                  img.dataset.triedContests = 'true';
                  img.dataset.triedCategories = 'true';
                  img.src = `${baseUrl}/uploads/categories/${filename}`;
                } else if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                  // First try was categories, now try contests
                  img.dataset.triedCategories = 'true';
                  img.dataset.triedContests = 'true';
                  img.src = `${baseUrl}/uploads/contests/${filename}`;
                } else {
                  // Both folders tried, give up
                  console.error('❌ QuizCard image failed in both folders:', {
                    contestName: name,
                    originalPath: contestImage
                  });
                  img.style.display = 'none';
                }
              }
            }}
          />
        ) : (
          getQuizIcon(name, category)
        )}
      </div>

      {/* Title Strip */}
      <div className="bg-[#FFF6D9] rounded-b-xl px-2 py-2 min-h-[48px] flex items-center justify-center">
        <h3 className="text-[#0D0009] font-semibold text-sm text-center leading-tight break-words">
          {name}
        </h3>
      </div>
    </div>
  );
};

