'use client';

import { motion } from 'framer-motion';

interface BattleScreenProps {
  userCard: React.ReactNode;
  opponentCard: React.ReactNode;
}

export default function BattleScreen({ userCard, opponentCard }: BattleScreenProps) {
  return (
    <div className="relative w-full max-w-6xl mx-auto min-h-96 overflow-hidden rounded-2xl bg-gray-900">
      {/* User Card - Static, always visible, never animated, fixed position */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10">
        <div className="rounded-xl shadow-lg bg-gray-800 p-6">
          {userCard}
        </div>
      </div>

      {/* Opponent Wrapper - Animated container with background that slides from right to left */}
      <motion.div
        className="absolute right-8 top-1/2 -translate-y-1/2 z-10"
        initial={{ x: '100vw' }}
        animate={{ x: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.7,
          ease: 'easeOut',
        }}
      >
        <div className="rounded-xl shadow-lg bg-gray-800 p-6">
          {opponentCard}
        </div>
      </motion.div>
    </div>
  );
}