import { Contest } from './api';

/**
 * Check if a daily contest is currently live based on the current time
 * @param dailyStartTime Time in HH:mm format (e.g., "15:00")
 * @param dailyEndTime Time in HH:mm format (e.g., "16:00")
 * @returns true if current time is between start and end time
 */
export function isDailyContestLive(dailyStartTime: string | null | undefined, dailyEndTime: string | null | undefined): boolean {
  if (!dailyStartTime || !dailyEndTime) return false;

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  const [startHours, startMinutes] = dailyStartTime.split(':').map(Number);
  const [endHours, endMinutes] = dailyEndTime.split(':').map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
}

/**
 * Get the next occurrence of daily contest start time
 * @param dailyStartTime Time in HH:mm format
 * @returns Date object for next occurrence
 */
export function getNextDailyStartTime(dailyStartTime: string | null | undefined): Date | null {
  if (!dailyStartTime) return null;

  const now = new Date();
  const [hours, minutes] = dailyStartTime.split(':').map(Number);
  
  const nextStart = new Date(now);
  nextStart.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, set it for tomorrow
  if (nextStart <= now) {
    nextStart.setDate(nextStart.getDate() + 1);
  }

  return nextStart;
}

/**
 * Get time remaining until daily contest starts
 * @param dailyStartTime Time in HH:mm format
 * @returns Formatted time string (HH:MM:SS or Xd Xh) or empty string
 */
export function getTimeUntilDailyStart(dailyStartTime: string | null | undefined): string {
  const nextStart = getNextDailyStartTime(dailyStartTime);
  if (!nextStart) return '';

  const now = new Date();
  const diff = nextStart.getTime() - now.getTime();

  if (diff <= 0) return '00:00:00';

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // If more than 24 hours, show days and hours
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d ${hours}h`;
  }

  // Otherwise show hours:minutes:seconds
  return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Get time remaining until daily contest ends
 * @param dailyEndTime Time in HH:mm format
 * @returns Formatted time string (HH:MM:SS or Xd Xh) or empty string
 */
export function getTimeUntilDailyEnd(dailyEndTime: string | null | undefined): string {
  if (!dailyEndTime) return '';

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  const [endHours, endMinutes] = dailyEndTime.split(':').map(Number);
  const endTotalMinutes = endHours * 60 + endMinutes;

  // If end time has passed today, calculate for tomorrow
  let diffMinutes = endTotalMinutes - currentTotalMinutes;
  if (diffMinutes <= 0) {
    diffMinutes += 24 * 60; // Add 24 hours
  }

  const totalHours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const seconds = 0; // We don't have seconds precision for daily times

  // If more than 24 hours, show days and hours
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d ${hours}h`;
  }

  // Otherwise show hours:minutes:seconds
  return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Check if contest is a daily contest
 */
export function isDailyContest(contest: Contest): boolean {
  return contest.isDaily === true;
}

