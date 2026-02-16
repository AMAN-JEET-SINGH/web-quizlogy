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

      const userData = await authApi.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      if (userData.profile) {
        setMobileNo(userData.profile.mobileNo || '');
        setWhatsappNo(userData.profile.whatsappNo || '');
        setAddress(userData.profile.address || '');
        setCity(userData.profile.city || '');
        setCountry(userData.profile.country || '');
        setPostalCode(userData.profile.postalCode || '');
        if (userData.profile.whatsappNo && userData.profile.mobileNo &&
            userData.profile.whatsappNo === userData.profile.mobileNo) {
          setUseSameAsMobile(true);
        }
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('user');
        setUser(null);
        setIsRedirecting(true);
        router.push('/login');
        return;
      } else {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
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

  const handleWhatsAppCheckboxChange = (checked: boolean) => {
    setUseSameAsMobile(checked);
    if (checked && mobileNo) {
      setWhatsappNo(mobileNo);
    } else if (!checked) {
      setWhatsappNo('');
    }
  };

  const handleMobileNoChange = (value: string) => {
    setMobileNo(value);
    if (useSameAsMobile) {
      setWhatsappNo(value);
    }
  };

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

      if (updatedUser.profile) {
        setMobileNo(updatedUser.profile.mobileNo || '');
        setWhatsappNo(updatedUser.profile.whatsappNo || '');
        setAddress(updatedUser.profile.address || '');
        setCity(updatedUser.profile.city || '');
        setCountry(updatedUser.profile.country || '');
        setPostalCode(updatedUser.profile.postalCode || '');
      }

      alert('Profile saved successfully!');
      router.push('/dashboard');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
              className="bg-[#FFD602] text-[#0D0009] px-6 py-3 rounded-lg font-bold hover:bg-[#FFE033] transition-colors"
            >
              Go to Login
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
      <div className="min-h-screen bg-[#0D0009] p-5">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-[#FFF6D9] hover:text-[#FFD602] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-[#FFF6D9] text-xl font-bold">My Profile</h1>
            <div className="w-16"></div>
          </div>

          {/* Profile Picture & Name Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#9272FF] to-[#6B4EFF] flex items-center justify-center border-4 border-[#564C53] shadow-lg overflow-hidden mb-4">
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
                <img src="/logo.svg" alt="Profile" className="w-12 h-12" />
              )}
            </div>

            {/* Name with edit */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave();
                      if (e.key === 'Escape') handleNameCancel();
                    }}
                    className="bg-white text-[#0D0009] text-lg font-semibold px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602]"
                    autoFocus
                  />
                  <button onClick={handleNameSave} className="text-green-500 hover:text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button onClick={handleNameCancel} className="text-red-500 hover:text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-[#FFF6D9] text-xl font-bold">{user?.name || 'N/A'}</h2>
                  <button onClick={handleNameEdit} className="text-[#FFD602] hover:text-[#FFE033]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <p className="text-[#FFF6D9]/60 text-sm mt-1">{user?.email || ''}</p>
          </div>

          {/* Profile Form */}
          <div className="bg-[#1a0f15] rounded-2xl p-5 border border-[#564C53]">
            <h3 className="text-[#FFF6D9] text-lg font-bold mb-5">Personal Information</h3>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Mobile Number */}
              <div>
                <label className="text-[#FFF6D9]/70 text-sm mb-2 block">Mobile Number</label>
                <input
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => handleMobileNoChange(e.target.value)}
                  placeholder="Enter mobile number"
                  className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] placeholder:text-gray-400"
                />
              </div>

              {/* WhatsApp Number */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#FFF6D9]/70 text-sm">WhatsApp Number</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSameAsMobile}
                      onChange={(e) => handleWhatsAppCheckboxChange(e.target.checked)}
                      className="w-4 h-4 text-[#FFD602] bg-white border-gray-300 rounded focus:ring-[#FFD602]"
                    />
                    <span className="text-[#FFF6D9]/60 text-xs">Same as mobile</span>
                  </label>
                </div>
                <input
                  type="tel"
                  value={whatsappNo}
                  onChange={(e) => setWhatsappNo(e.target.value)}
                  placeholder="Enter WhatsApp number"
                  disabled={useSameAsMobile}
                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] placeholder:text-gray-400 ${
                    useSameAsMobile
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-white text-[#0D0009]'
                  }`}
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-[#FFF6D9]/70 text-sm mb-2 block">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your address"
                  rows={2}
                  className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] resize-none placeholder:text-gray-400"
                />
              </div>

              {/* City & Country Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#FFF6D9]/70 text-sm mb-2 block">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="text-[#FFF6D9]/70 text-sm mb-2 block">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Postal Code */}
              <div>
                <label className="text-[#FFF6D9]/70 text-sm mb-2 block">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Enter postal code"
                  className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD602] placeholder:text-gray-400"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="w-full bg-[#FFD602] text-[#0D0009] font-bold py-3 px-4 rounded-lg hover:bg-[#FFE033] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Account Settings */}
          <div className="bg-[#1a0f15] rounded-2xl p-5 border border-[#564C53] mt-4">
            <h3 className="text-[#FFF6D9] text-lg font-bold mb-4">Settings</h3>

            {/* Privacy & Security - Links to Privacy Policy */}
            <button
              onClick={() => router.push('/privacy-policy')}
              className="w-full flex items-center justify-between py-3 border-b border-[#564C53]/50 hover:bg-[#0D0009]/30 transition-colors rounded-lg px-2 -mx-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#9272FF]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#9272FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-[#FFF6D9] text-sm font-medium">Privacy & Security</p>
                  <p className="text-[#FFF6D9]/50 text-xs">View our privacy policy</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-[#FFF6D9]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between py-3 hover:bg-[#0D0009]/30 transition-colors rounded-lg px-2 -mx-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-[#FFF6D9] text-sm font-medium">Delete Account</p>
                  <p className="text-[#FFF6D9]/50 text-xs">Permanently remove your account</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-[#FFF6D9]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Logout Button at Bottom */}
          <button
            onClick={handleLogout}
            className="w-full mt-6 py-3 px-4 rounded-lg border border-[#564C53] text-[#FFF6D9] font-medium hover:bg-[#1a0f15] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a0f15] rounded-2xl p-6 max-w-sm w-full border border-[#564C53]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-[#FFF6D9] text-lg font-bold">Delete Account?</h3>
                <p className="text-[#FFF6D9]/50 text-sm">This cannot be undone</p>
              </div>
            </div>
            <p className="text-[#FFF6D9]/70 mb-6 text-sm">
              All your data, coins, and contest history will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-white text-[#0D0009] font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
