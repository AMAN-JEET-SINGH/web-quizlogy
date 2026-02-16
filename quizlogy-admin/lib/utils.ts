import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath || imagePath.trim() === '' || imagePath === 'default' || imagePath === 'placeholder') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    return `${apiUrl}/placeholder.jpg`;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const digitalOceanUrl = process.env.NEXT_PUBLIC_DIGITAL_OCEAN_IMAGE_URL;

  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  // If it's already a full URL, fix port if needed
  if (cleanPath.startsWith('http')) {
    // Always use backend port (5001) for upload URLs
    if (cleanPath.includes('/uploads/')) {
      return cleanPath.replace(/localhost:\d+/, 'localhost:5001').replace(/http:\/\/[^/]+/, apiUrl);
    }
    // If it's already correct, return as is
    if (cleanPath.includes('localhost:5001') || cleanPath.includes(apiUrl)) {
      return cleanPath;
    }
    // Otherwise, replace the host with API URL
    return cleanPath.replace(/https?:\/\/[^/]+/, apiUrl);
  }

  // If it starts with uploads/, serve from backend
  if (cleanPath.startsWith('uploads/')) {
    if (isProduction && digitalOceanUrl) {
      return `${digitalOceanUrl}/${cleanPath}`;
    } else {
      return `${apiUrl}/${cleanPath}`;
    }
  }

  // For other paths, use API URL
  if (isProduction && digitalOceanUrl) {
    return `${digitalOceanUrl}/${cleanPath}`;
  } else {
    return `${apiUrl}/${cleanPath}`;
  }
};

