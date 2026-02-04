# Fix TypeScript Error on Server

## The Problem
The server file `quizlogy-frontend/app/all-contests/page.tsx` has OLD code that tries to create Date objects directly without checking for daily contests first.

## Step-by-Step Fix

### 1. On the server, open the file:
```bash
cd ~/var/www/ff-quiz-karekaise/quizlogy-frontend
nano app/all-contests/page.tsx
```

### 2. Find the `sortContests` function (around line 20-95)

### 3. Look for this OLD code (WRONG - causes error):
```typescript
contests.forEach((contest) => {
  const start = new Date(contest.startDate);  // ❌ ERROR LINE 28
  const end = new Date(contest.endDate);
  // ... rest of old code
});
```

### 4. REPLACE the entire `sortContests` function with this:

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
        return;
      }

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

### 5. Save the file (Ctrl+X, then Y, then Enter in nano)

### 6. Clear Next.js cache and rebuild:
```bash
rm -rf .next
npm run build
```

## Key Differences:
- ✅ NEW: Checks `if (isDailyContest(contest))` FIRST
- ✅ NEW: Only processes regular contests in the `else` block
- ✅ NEW: Uses `as string` type assertion after null checks
- ❌ OLD: Tried to create Date objects directly (causes error)

