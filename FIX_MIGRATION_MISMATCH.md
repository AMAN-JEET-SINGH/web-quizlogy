# Fix Migration Mismatch Error

## Problem

You have a migration mismatch:
- Database has: `20260102132022_add_daily_contest_fields` (not in local files)
- Local has: `20260102120216_add_daily_contest_fields` (same migration, different timestamp)
- 4 new migrations need to be applied

## Solution

Since the tables already exist in your database, we need to:
1. Mark the local migration as applied (since tables exist)
2. Apply the 4 new migrations

## Commands to Run on VPS

```bash
# 1. Navigate to backend
cd ~/var/www/ff-quiz-karekaise/quizlogy-backend

# 2. Mark the local migration as applied (tables already exist)
npx prisma migrate resolve --applied 20260102120216_add_daily_contest_fields

# 3. Check status again
npx prisma migrate status

# 4. Now apply the remaining migrations
npx prisma migrate deploy

# 5. Generate Prisma client
npx prisma generate

# 6. Build and restart
npm run build
pm2 restart quizlogy-backend
```

## Alternative: If Migrations Still Fail

If some of the new migrations also fail because tables/columns already exist:

```bash
# Check which ones fail
npx prisma migrate deploy

# If visitor_ips table already exists:
npx prisma migrate resolve --applied 20260104091032_add_visitor_ip_tracking

# If clickCount columns already exist:
npx prisma migrate resolve --applied 20260104091245_add_click_tracking

# If lastSessionStart already exists:
npx prisma migrate resolve --applied 20260104095656_add_session_tracking

# If device info columns already exist:
npx prisma migrate resolve --applied 20260104101748_add_device_info_tracking

# Then try deploy again
npx prisma migrate deploy
```

## Verify Schema Matches

After fixing, verify your database schema matches the Prisma schema:

```bash
# Pull current database schema
npx prisma db pull

# Compare with schema.prisma
# If they match, you're good!
```

## Complete Fix Script

```bash
#!/bin/bash
cd ~/var/www/ff-quiz-karekaise/quizlogy-backend

echo "Fixing migration mismatch..."

# Mark local migration as applied
npx prisma migrate resolve --applied 20260102120216_add_daily_contest_fields

# Try to apply new migrations
npx prisma migrate deploy

# If any fail, check what's missing and mark as applied
# Then run deploy again

# Generate client
npx prisma generate

# Build
npm run build

echo "Done! Check status:"
npx prisma migrate status
```

