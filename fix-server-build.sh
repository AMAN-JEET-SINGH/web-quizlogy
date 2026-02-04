#!/bin/bash

# Script to fix the TypeScript error on server
# Run this on the server: bash fix-server-build.sh

FILE_PATH="quizlogy-frontend/app/all-contests/page.tsx"

echo "Fixing sortContests function in $FILE_PATH..."

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File $FILE_PATH not found!"
    exit 1
fi

# Create backup
cp "$FILE_PATH" "${FILE_PATH}.backup"
echo "Backup created: ${FILE_PATH}.backup"

# The fix: Replace the old forEach block with the new one
# This uses sed to replace the problematic code

# First, let's check if the old code exists
if grep -q "const start = new Date(contest.startDate);" "$FILE_PATH"; then
    echo "Found old code. Replacing..."
    
    # This is a complex replacement, so we'll use a different approach
    # We'll create a temporary file with the fix
    cat > /tmp/sortContests_fix.txt << 'ENDOFFIX'
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
ENDOFFIX

    echo "Please manually replace the forEach block in the file."
    echo "See FIX_SERVER_ERROR.md for complete instructions."
else
    echo "File appears to already have the fix, or structure is different."
    echo "Please verify the file manually."
fi

echo "Done. Please check the file and run: npm run build"

