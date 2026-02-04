import prisma from '../config/database';

export interface CreateCoinHistoryParams {
  userId: string;
  amount: number;
  type: 'EARNED' | 'SPENT' | 'REFUND' | 'LOGIN';
  description: string;
  contestId?: string | null;
}

/**
 * Helper function to create coin history entries consistently
 * This ensures all coin history entries are created with proper validation
 */
export async function createCoinHistory(params: CreateCoinHistoryParams) {
  try {
    const { userId, amount, type, description, contestId } = params;

    // Validate amount based on type
    if (type === 'EARNED' && amount < 0) {
      throw new Error('EARNED type requires positive amount');
    }
    if (type === 'SPENT' && amount > 0) {
      throw new Error('SPENT type requires negative amount');
    }
    if (type === 'LOGIN' && amount !== 0) {
      // LOGIN type should have 0 amount, but we allow it for flexibility
      console.warn('LOGIN type typically has 0 amount');
    }

    // Create coin history entry
    const coinHistory = await prisma.coinHistory.create({
      data: {
        userId,
        amount: parseInt(amount.toString()),
        type,
        description: description.trim(),
        contestId: contestId || null,
      },
    });

    return coinHistory;
  } catch (error: any) {
    console.error('Error creating coin history:', error);
    throw error;
  }
}

/**
 * Helper function to create coin history with coin balance update in a transaction
 * This ensures coins and history are always in sync
 */
export async function createCoinHistoryWithUpdate(
  params: CreateCoinHistoryParams & { coinChange: number }
) {
  try {
    const { userId, coinChange, ...historyParams } = params;

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update user coins
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            increment: coinChange,
          },
        },
        select: {
          coins: true,
        },
      });

      // Create coin history entry
      const coinHistory = await tx.coinHistory.create({
        data: {
          userId,
          amount: parseInt(historyParams.amount.toString()),
          type: historyParams.type,
          description: historyParams.description.trim(),
          contestId: historyParams.contestId || null,
        },
      });

      return { user: updatedUser, coinHistory };
    });

    return result;
  } catch (error: any) {
    console.error('Error creating coin history with update:', error);
    throw error;
  }
}

