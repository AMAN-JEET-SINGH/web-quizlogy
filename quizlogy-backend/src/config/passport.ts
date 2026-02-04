import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './database';

// Only initialize GoogleStrategy if required environment variables are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (!user) {
          // Create new user
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails?.[0]?.value || '',
              name: profile.displayName || '',
              picture: profile.photos?.[0]?.value || null,
              givenName: profile.name?.givenName || null,
              familyName: profile.name?.familyName || null,
            },
          });
        } else {
          // Update user info if needed
          user = await prisma.user.update({
            where: { googleId: profile.id },
            data: {
              email: profile.emails?.[0]?.value || user.email,
              name: profile.displayName || user.name,
              picture: profile.photos?.[0]?.value || user.picture,
              givenName: profile.name?.givenName || user.givenName,
              familyName: profile.name?.familyName || user.familyName,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, undefined);
      }
    }
  )
  );
} else {
  console.warn('⚠️  Google OAuth credentials not found. Google OAuth authentication will not be available.');
  console.warn('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || undefined);
  } catch (error) {
    done(error, undefined);
  }
});

export default passport;

