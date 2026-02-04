# Server Fix Instructions for quizlogy-frontend/app/all-contests/page.tsx

## The Problem
The server file has OLD code that tries to create Date objects directly without checking for daily contests first.

## The Fix

On the server, open the file:
```bash
nano ~/var/www/ff-quiz-karekaise/quizlogy-frontend/app/all-contests/page.tsx
```

Find the `sortContests` function (should start around line 20-21).

**REPLACE the entire function** with this corrected version:

```typescript
// Sort contests: Live Daily (highest priority) > Active > Upcoming Daily > Upcoming > Past Daily > Past
const sortContests = (contests: Contest[]): Contest[] => {
  const now = new Date();

  const liveDaily: Contest[] = [];
  const active: Contest[] = [];
  const upcomingDaily: Contest[] = [];
  const upcoming: Contest[] = [];
  const pastDaily: Contest[] = [];
  const past: Contest[] = [];

  contests.forEach((contest) => {
    if (isDailyContest(contest)) {
      // Daily contest logic
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        liveDaily.push(contest);
      } else {
        // Check if it's past today's end time
        const [endHours, endMinutes] = (contest.dailyEndTime || '23:59').split(':').map(Number);
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        if (currentTotalMinutes >= endTotalMinutes) {
          pastDaily.push(contest);
        } else {
          upcomingDaily.push(contest);
        }
      }
    } else {
      // Regular contest logic
      const startDate = contest.startDate;
      const endDate = contest.endDate;
      
      if (!startDate || !endDate) {
        past.push(contest);
        return; // Skip to next iteration in forEach
      }

      // At this point, TypeScript knows startDate and endDate are not null
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (now >= start && now <= end) {
        active.push(contest);
      } else if (now < start) {
        upcoming.push(contest);
      } else {
        past.push(contest);
      }
    }
  });

  // Sort active by end date (ascending - ending soon first)
  active.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  // Sort upcoming by start date (ascending - starting soon first)
  upcoming.sort((a, b) => {
    if (!a.startDate || !b.startDate) return 0;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // Sort past by end date (descending - most recent first)
  past.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

  return [...liveDaily, ...active, ...upcomingDaily, ...upcoming, ...pastDaily, ...past];
};
```

## Key Changes:
1. ✅ Checks `if (isDailyContest(contest))` FIRST before trying to access dates
2. ✅ Only processes regular contests in the `else` block
3. ✅ Uses type assertions `as string` after null checks
4. ✅ Handles null dates properly

After replacing, save the file and run:
```bash
npm run build
```

