'use client';

interface LoadingScreenProps {
  message?: string;
  /** Use when page has its own nav/footer (e.g. full page load) */
  fullPage?: boolean;
  /** Optional class for the wrapper */
  className?: string;
}

export function LoadingScreen({ message = 'Loading...', fullPage = true, className = '' }: LoadingScreenProps) {
  return (
    <div
      className={
        fullPage
          ? `min-h-screen bg-[#0D0009] flex flex-col items-center justify-center px-4 ${className}`.trim()
          : `flex flex-col items-center justify-center py-12 px-4 ${className}`.trim()
      }
      style={fullPage ? { boxShadow: '0px 0px 2px 0px #FFF6D9' } : undefined}
    >
      {/* Spinner ring with logo in center */}
      <div className="relative mb-6">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/logo.svg" alt="" className="w-6 h-6 sm:w-8 sm:h-8 opacity-90" />
        </div>
      </div>
      {/* Message */}
      <p className="text-[#FFF6D9] text-base sm:text-lg font-medium text-center max-w-xs">
        {message}
      </p>
      {/* Animated dots */}
      <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
    </div>
  );
}
