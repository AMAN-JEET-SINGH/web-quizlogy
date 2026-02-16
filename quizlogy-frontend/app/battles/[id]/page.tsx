'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SEOHead } from '@/components/SEOHead';
import { battlesApi, Battle, authApi, User } from '@/lib/api';
import './battle-play.css';
import AdsenseAd from '@/components/AdsenseAd';

// 20 Arabian and Pakistani names
const OPPONENT_NAMES = [
    'Arin', 'Kairo', 'Zyra', 'Riven', 'Nova',
    'Elix', 'Veyra', 'Zorin', 'Nyxen', 'Aeris',
    'Kael', 'Lunor', 'Xyra', 'Orin', 'Vexo',
    'Nira', 'Solin', 'Myra', 'Tavin', 'Zela'
  ];

export default function BattlePlayPage() {
  const router = useRouter();
  const params = useParams();
  const battleId = params?.id as string;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [opponentSelected, setOpponentSelected] = useState(false);
  const [selectedOpponentIndex, setSelectedOpponentIndex] = useState(0);
  const [opponentName, setOpponentName] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppedRef = useRef(false);
  const spinningReelAudioRef = useRef<HTMLAudioElement | null>(null);
  const countAudioRef = useRef<HTMLAudioElement | null>(null);
  const countTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBattleData();
    fetchUserData();
  }, [battleId]);

  const fetchBattleData = async () => {
    try {
      setLoading(true);
      const data = await battlesApi.getById(battleId);
      // Handle both response formats
      const battleData = (data as any).data || data;
      setBattle(battleData);
    } catch (err) {
      console.error('Error fetching battle:', err);
      router.push('/battles');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err) {
          // Keep stored user if API fails
          setUser(parsedUser);
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const startOpponentSelection = () => {
    // Clear any existing intervals/timeouts first
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (countTimeoutRef.current) {
      clearTimeout(countTimeoutRef.current);
      countTimeoutRef.current = null;
    }

    // Stop any playing count audio
    if (countAudioRef.current) {
      countAudioRef.current.pause();
      countAudioRef.current.currentTime = 0;
    }

    setSpinning(true);
    setOpponentSelected(false);

    // Play spinning reel sound in loop
    if (spinningReelAudioRef.current) {
      spinningReelAudioRef.current.currentTime = 0;
      spinningReelAudioRef.current.loop = true;
      spinningReelAudioRef.current.play().catch(err => {
        console.error('Error playing spinning reel sound:', err);
      });
    }

    // Randomly select opponent name first
    const randomName = OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)];
    setOpponentName(randomName);

    // Reset stopped flag
    isStoppedRef.current = false;

    // Spin through images rapidly
    let currentIndex = Math.floor(Math.random() * 12);
    setSelectedOpponentIndex(currentIndex);

    // Start spinning images
    spinIntervalRef.current = setInterval(() => {
      if (isStoppedRef.current) {
        return;
      }
      currentIndex = (currentIndex + 1) % 12;
      setSelectedOpponentIndex(currentIndex);
    }, 200); // Change image every 600ms for smooth, slow scrolling

    // Stop after 3 seconds
    stopTimeoutRef.current = setTimeout(() => {
      // Mark as stopped first
      isStoppedRef.current = true;

      // Stop the interval immediately
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }

      // Final selection - pick random image index and set it
      const finalIndex = Math.floor(Math.random() * 12);
      setSelectedOpponentIndex(finalIndex);

      // Stop spinning and show name after animation completes
      setTimeout(() => {
        setSpinning(false);
        setOpponentSelected(true);
      }, 1000); // Wait for scroll animation to complete
    }, 3000); // Stop after 3 seconds
  };

  useEffect(() => {
    // Auto-start opponent selection when page loads
    if (!loading && battle) {
      setTimeout(() => {
        startOpponentSelection();
      }, 500);
    }

    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (countTimeoutRef.current) {
        clearTimeout(countTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      // Clean up audio
      if (spinningReelAudioRef.current) {
        spinningReelAudioRef.current.pause();
        spinningReelAudioRef.current.currentTime = 0;
      }
      if (countAudioRef.current) {
        countAudioRef.current.pause();
        countAudioRef.current.currentTime = 0;
      }
    };
  }, [loading, battle]);

  useEffect(() => {
    // When opponent is selected, stop spinning reel and play count sound
    if (opponentSelected) {
      // Stop spinning reel sound
      if (spinningReelAudioRef.current) {
        spinningReelAudioRef.current.pause();
        spinningReelAudioRef.current.currentTime = 0;
        spinningReelAudioRef.current.loop = false;
      }

      // Play count sound
      if (countAudioRef.current) {
        countAudioRef.current.currentTime = 0;
        countAudioRef.current.play().catch(err => {
          console.error('Error playing count sound:', err);
        });
      }
    }
  }, [opponentSelected]);

  // Handle navigation when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && opponentSelected && battleId) {
      router.push(`/battles/${battleId}/play`);
    }
  }, [countdown, opponentSelected, battleId, router]);

  useEffect(() => {
    // Start countdown when opponent is selected
    if (opponentSelected && battleId) {
      // Store opponent info in localStorage
      const opponentIndex = selectedOpponentIndex + 1;
      localStorage.setItem('battleOpponentName', opponentName);
      localStorage.setItem('battleOpponentIndex', opponentIndex.toString());

      // Reset countdown to 3
      setCountdown(3);

      // Start countdown interval
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // When countdown reaches 0, clear interval
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [opponentSelected, battleId, selectedOpponentIndex, opponentName]);

  const getUserImage = () => {
    if (user?.picture) {
      return user.picture;
    }
    return '/defaultpf.svg';
  };

  const getUserName = () => {
    if (user?.name) {
      return user.name;
    }
    return 'You';
  };

  const getOpponentImage = () => {
    const imageNumber = selectedOpponentIndex + 1;
    // Try to load from public folder
    return `/p${imageNumber}.svg`;
  };

  if (loading) {
    return (
      <>
        <SEOHead title="Loading Battle..." description="Loading battle opponent selection..." />
        <div className="battle-play-page">
          <DashboardNav />
          <LoadingScreen message="Loading battle..." fullPage />
          <Footer />
        </div>
      </>
    );
  }

  if (!battle) {
    return null;
  }

  return (
    <>
      <SEOHead
        title={`${battle.name} - Battle`}
        description={`Challenge yourself in ${battle.name || 'Battle'}`}
      />
      <DashboardNav />
      {/* Audio elements for opponent selection */}
      <audio ref={spinningReelAudioRef} src="/spinning-reel.mp3" preload="auto" loop />
      <audio ref={countAudioRef} src="/count.wav" preload="auto" />
      <div className="battle-play-page ">


        <div className="battle-opponent-selection">
          <div className="opponent-card">
            <h2 className="opponent-title">Finding a Worthy Opponent</h2>

            <div className="opponent-vs-container">
              {/* User Section */}
              <div className="opponent-section">
                <div className="opponent-avatar">
                  <img
                    src={getUserImage()}
                    alt={getUserName()}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = '/defaultpf.svg';
                    }}
                  />
                </div>
                <div className="opponent-name">{getUserName()}</div>
              </div>

              {/* VS Symbol */}
              <div className="vs-symbol">

                <img src="/vss.svg" alt="VS" className="w-18 h-18 object-contain" />
              </div>

              {/* Opponent Section */}
              <div className="opponent-section">
                <div className={`opponent-avatar opponent-avatar-spin ${spinning ? 'spinning' : ''}`}>
                  {spinning ? (
                    <div className="avatar-scroll-container">
                      {Array.from({ length: 12 }).map((_, idx) => {
                        const imageIndex = ((selectedOpponentIndex + idx) % 12) + 1;
                        return (
                          <div key={`opponent-scroll-${idx}`} className="avatar-scroll-item">
                            <img
                              src={`/p${imageIndex}.svg`}
                              alt="Opponent"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.src = '/p1.svg';
                              }}
                            />
                          </div>
                        );
                      })}
                      {/* Duplicate first item for seamless loop */}
                      <div className="avatar-scroll-item">
                        <img
                          src={getOpponentImage()}
                          alt="Opponent"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = '/p1.svg';
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <img
                      key={`opponent-${selectedOpponentIndex}`}
                      src={getOpponentImage()}
                      alt="Opponent"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = '/p1.svg';
                      }}
                    />
                  )}
                </div>
                <div className="opponent-name">{opponentSelected ? opponentName : '...'}</div>
              </div>
            </div>

            {opponentSelected && (
              <div className="opponent-selected-actions">
                <p className="redirect-message">Starting in {countdown}...</p>
              </div>
            )}
          </div>
        </div>


      </div>
      <p className="text-center text-white text-xs mt-2 mb-2 font-medium">ADVERTISEMENT</p>
      <div className="w-full overflow-hidden border-b border-[#564C53]">
        <AdsenseAd adSlot="8153775072" adFormat="auto" />
      </div>
      <Footer />
    </>
  );
}
