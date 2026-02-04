'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingPicture, setIsEditingPicture] = useState(false);
  const [pictureUrl, setPictureUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Profile fields state
  const [mobileNo, setMobileNo] = useState('');
  const [whatsappNo, setWhatsappNo] = useState('');
  const [useSameAsMobile, setUseSameAsMobile] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setImageError(false);
      
      // Fetch fresh data from API first
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Load profile fields
      if (userData.profile) {
        setMobileNo(userData.profile.mobileNo || '');
        setWhatsappNo(userData.profile.whatsappNo || '');
        setAddress(userData.profile.address || '');
        setCity(userData.profile.city || '');
        setCountry(userData.profile.country || '');
        setPostalCode(userData.profile.postalCode || '');
        // Check if WhatsApp is same as mobile
        if (userData.profile.whatsappNo && userData.profile.mobileNo && 
            userData.profile.whatsappNo === userData.profile.mobileNo) {
          setUseSameAsMobile(true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      // If not authenticated (401), clear localStorage and redirect to login
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('user');
        setUser(null);
        setIsRedirecting(true);
        router.push('/login');
        return;
      } else {
        // Try to get from localStorage as fallback
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            // Load profile fields from stored user
            if (parsedUser.profile) {
              setMobileNo(parsedUser.profile.mobileNo || '');
              setWhatsappNo(parsedUser.profile.whatsappNo || '');
              setAddress(parsedUser.profile.address || '');
              setCity(parsedUser.profile.city || '');
              setCountry(parsedUser.profile.country || '');
              setPostalCode(parsedUser.profile.postalCode || '');
              if (parsedUser.profile.whatsappNo && parsedUser.profile.mobileNo && 
                  parsedUser.profile.whatsappNo === parsedUser.profile.mobileNo) {
                setUseSameAsMobile(true);
              }
            }
          } catch (parseErr) {
            console.error('Error parsing stored user:', parseErr);
            setError('Failed to load profile. Please try again.');
          }
        } else {
          setError('Failed to load profile. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      localStorage.removeItem('user');
      router.push('/login');
    } catch (err) {
      console.error('Error logging out:', err);
      // Still clear local storage and redirect
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const handleNameEdit = () => {
    if (user) {
      setEditedName(user.name);
      setIsEditingName(true);
    }
  };

  const handleNameSave = async () => {
    if (!user || !editedName.trim()) {
      setIsEditingName(false);
      return;
    }

    try {
      const updatedUser = await authApi.updateProfile({ name: editedName.trim() });
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating name:', err);
      alert('Failed to update name. Please try again.');
    }
  };

  const handleNameCancel = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handlePictureEdit = () => {
    if (user) {
      setPictureUrl(user.picture || '');
      setIsEditingPicture(true);
    }
  };

  const handlePictureSave = async () => {
    if (!user) return;

    try {
      const updatedUser = await authApi.updateProfile({ 
        picture: pictureUrl.trim() || null 
      });
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setImageError(false);
      setIsEditingPicture(false);
    } catch (err) {
      console.error('Error updating picture:', err);
      alert('Failed to update profile picture. Please try again.');
    }
  };

  const handlePictureCancel = () => {
    setIsEditingPicture(false);
    setPictureUrl('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, convert to data URL (base64)
    // In production, you'd want to upload to a server
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        setUploading(true);
        const updatedUser = await authApi.updateProfile({ picture: base64String });
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setImageError(false);
        setIsEditingPicture(false);
      } catch (err) {
        console.error('Error uploading picture:', err);
        alert('Failed to upload picture. Please try again.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle WhatsApp checkbox change
  const handleWhatsAppCheckboxChange = (checked: boolean) => {
    setUseSameAsMobile(checked);
    if (checked && mobileNo) {
      setWhatsappNo(mobileNo);
    } else if (!checked) {
      setWhatsappNo('');
    }
  };

  // Handle mobile number change
  const handleMobileNoChange = (value: string) => {
    setMobileNo(value);
    if (useSameAsMobile) {
      setWhatsappNo(value);
    }
  };

  // Save profile fields
  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const finalWhatsappNo = useSameAsMobile ? mobileNo : whatsappNo;
      const updatedUser = await authApi.updateProfile({
        mobileNo: mobileNo.trim() || null,
        whatsappNo: finalWhatsappNo.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        postalCode: postalCode.trim() || null,
      });
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update local state from response
      if (updatedUser.profile) {
        setMobileNo(updatedUser.profile.mobileNo || '');
        setWhatsappNo(updatedUser.profile.whatsappNo || '');
        setAddress(updatedUser.profile.address || '');
        setCity(updatedUser.profile.city || '');
        setCountry(updatedUser.profile.country || '');
        setPostalCode(updatedUser.profile.postalCode || '');
      }
      
      alert('Profile saved successfully!');
      
      // Redirect to dashboard after saving profile (especially for new users)
      router.push('/dashboard');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Delete account (calls backend DELETE /auth/me to remove user from DB)
  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await authApi.deleteAccount();
      setShowDeleteConfirm(false);
      localStorage.removeItem('user');
      localStorage.removeItem('guestCoins');
      alert('Your account has been deleted successfully.');
      router.push('/login');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      const message = err?.response?.data?.error || err?.message || 'Please try again.';
      alert(`Failed to delete account. ${message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || isRedirecting) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
          <div className="text-[#FFF6D9] text-lg">
            {isRedirecting ? 'Redirecting to login...' : 'Loading profile...'}
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (error && !user) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-yellow-400 text-[#0D0009] px-6 py-3 rounded-xl font-bold hover:bg-yellow-500 relative overflow-hidden"
            >
              <span className="relative z-10">Go to Login</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead 
        title="My Profile - Quizwala User Profile & Settings"
        description="View and manage your Quizwala profile. Check your stats, edit your name, view your achievements, and manage your account settings."
        keywords="quiz profile, user profile, quiz account, profile settings, quiz stats, quiz achievements"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-md mx-auto">
          {/* Profile Header */}
          <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-[#BFBAA7] relative" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            {/* Back Arrow */}
            <button
              onClick={() => router.push('/dashboard')}
              className="absolute top-4 left-4 text-[#0D0009] hover:text-gray-600 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-[#0D0009] text-2xl font-bold ml-8">My Profile</h1>
              <button
                onClick={handleLogout}
                className="text-red-500 hover:text-red-600 text-sm font-medium underline"
              >
                Logout
              </button>
            </div>

            {/* Profile Picture */}
            <div className="flex justify-center mb-6 relative">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-[#FFF6D9] shadow-lg overflow-hidden">
                  {user?.picture && !imageError ? (
                    <img 
                      src={user.picture} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : user?.name ? (
                    <span className="text-white text-3xl font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <img src="/logo.svg" alt="Profile" className="w-16 h-16" />
                  )}
                </div>
                {/* Edit Picture Button */}
                <button
                  onClick={handlePictureEdit}
                  className="absolute bottom-0 right-0 bg-yellow-400 text-[#0D0009] w-8 h-8 rounded-full flex items-center justify-center hover:bg-yellow-500 transition-colors shadow-lg relative overflow-hidden"
                  title="Edit Profile Picture"
                >
                  <span className="relative z-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
                </button>
              </div>
            </div>

            {/* Picture Edit Modal */}
            {isEditingPicture && (
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-[#FFF6D9] rounded-xl p-6 max-w-md w-full border border-[#BFBAA7]" style={{
                  boxShadow: '0px 0px 2px 0px #FFF6D9'
                }}>
                  <h3 className="text-[#0D0009] text-xl font-bold mb-4">Edit Profile Picture</h3>
                  
                  <div className="mb-4">
                    <label className="text-[#0D0009]/70 text-sm mb-2 block">Upload Image</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full bg-[#0D0009] text-[#FFF6D9] py-2 px-4 rounded-lg hover:bg-[#0D0009]/80 transition-colors disabled:opacity-50 border border-[#BFBAA7]"
                    >
                      {uploading ? 'Uploading...' : 'Choose File'}
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="text-[#0D0009]/70 text-sm mb-2 block">Or Enter Image URL</label>
                    <input
                      type="text"
                      value={pictureUrl}
                      onChange={(e) => setPictureUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-white text-[#0D0009] py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handlePictureSave}
                      className="flex-1 bg-yellow-400 text-[#0D0009] font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors relative overflow-hidden"
                    >
                      <span className="relative z-10">Save</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
                    </button>
                    <button
                      onClick={handlePictureCancel}
                      className="flex-1 bg-[#0D0009] text-[#FFF6D9] font-bold py-2 px-4 rounded-lg hover:bg-[#0D0009]/80 transition-colors border border-[#BFBAA7]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User Information */}
            <div className="space-y-4">
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">Name</label>
                  {!isEditingName && (
                    <button
                      onClick={handleNameEdit}
                      className="text-yellow-400 hover:text-yellow-300 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave();
                        if (e.key === 'Escape') handleNameCancel();
                      }}
                      className="flex-1 bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                      autoFocus
                    />
                    <button
                      onClick={handleNameSave}
                      className="text-green-500 hover:text-green-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleNameCancel}
                      className="text-red-500 hover:text-red-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p className="text-[#FFF6D9] text-lg font-semibold">{user?.name || 'N/A'}</p>
                )}
              </div>

              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <label className="text-[#FFF6D9]/60 text-xs mb-1 block">Email</label>
                <p className="text-[#FFF6D9] text-lg font-semibold">{user?.email || 'N/A'}</p>
              </div>
            </div>

            {/* Profile Information Section */}
            <div className="space-y-4">
              {/* Mobile Number */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">Mobile Number</label>
                </div>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => handleMobileNoChange(e.target.value)}
                  placeholder="Enter mobile number"
                  className="w-full bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                />
              </div>

              {/* WhatsApp Number */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">WhatsApp Number</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSameAsMobile"
                      checked={useSameAsMobile}
                      onChange={(e) => handleWhatsAppCheckboxChange(e.target.checked)}
                      className="w-3 h-3 text-yellow-400 border-[#BFBAA7] rounded focus:ring-yellow-400"
                    />
                    <label htmlFor="useSameAsMobile" className="text-[#FFF6D9]/60 text-xs">
                      Same as mobile
                    </label>
                  </div>
                </div>
                <input
                  type="tel"
                  value={whatsappNo}
                  onChange={(e) => setWhatsappNo(e.target.value)}
                  placeholder="Enter WhatsApp number"
                  disabled={useSameAsMobile}
                  className={`w-full text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7] ${
                    useSameAsMobile 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-white text-[#0D0009]'
                  }`}
                />
              </div>

              {/* Address */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">Address</label>
                </div>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your address"
                  rows={2}
                  className="w-full bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7] resize-none"
                />
              </div>

              {/* City */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">City</label>
            </div>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter city"
                  className="w-full bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                />
          </div>

              {/* Country */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">Country</label>
                </div>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Enter country"
                  className="w-full bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                />
              </div>

              {/* Postal Code */}
              <div className="bg-[#0D0009] rounded-lg p-4 border border-[#BFBAA7]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#FFF6D9]/60 text-xs">Postal Code</label>
                </div>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Enter postal code"
                  className="w-full bg-white text-[#0D0009] text-lg font-semibold px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="w-full bg-yellow-400 text-[#0D0009] font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                <span className="relative z-10">{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
                </div>

            {/* Delete Account Section */}
            <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-red-500/50" style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}>
              <h2 className="text-red-600 text-xl font-bold mb-2">Danger Zone</h2>
              <p className="text-[#0D0009]/70 text-sm mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFF6D9] rounded-xl p-6 max-w-md w-full border border-[#BFBAA7]" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            <h3 className="text-[#0D0009] text-xl font-bold mb-4">Delete Account</h3>
            <p className="text-[#0D0009]/70 mb-6">
              Are you sure you want to delete your account? This action cannot be undone. All your data, coins, and contest history will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-[#0D0009] text-[#FFF6D9] font-bold py-2 px-4 rounded-lg hover:bg-[#0D0009]/80 transition-colors border border-[#BFBAA7] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}


