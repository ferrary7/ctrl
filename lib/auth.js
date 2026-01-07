import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * NextAuth v4 configuration for Strava OAuth
 */

export const authOptions = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  
  providers: [
    {
      id: 'strava',
      name: 'Strava',
      type: 'oauth',
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      authorization: {
        url: 'https://www.strava.com/oauth/authorize',
        params: {
          scope: 'read,activity:read_all',
          approval_prompt: 'auto',
          response_type: 'code'
        }
      },
      token: {
        url: 'https://www.strava.com/oauth/token',
        async request({ client, params }) {
          const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.STRAVA_CLIENT_ID,
              client_secret: process.env.STRAVA_CLIENT_SECRET,
              code: params.code,
              grant_type: 'authorization_code',
            }).toString(),
          });
          const tokens = await response.json();
          if (!response.ok) throw new Error(`Strava token error: ${JSON.stringify(tokens)}`);
          return { tokens };
        }
      },
      userinfo: {
        url: 'https://www.strava.com/api/v3/athlete',
        async request({ tokens }) {
          const response = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          return await response.json();
        }
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: `${profile.firstname} ${profile.lastname}`,
          email: profile.email || `${profile.id}@strava.user`,
          image: profile.profile,
        };
      }
    }
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'strava') {
        try {
          console.log('Processing Strava sign in for:', profile.id);
          
          // Check if user exists
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('strava_id', profile.id.toString())
            .maybeSingle();

          if (fetchError) {
            console.error('Error fetching user:', fetchError);
          }

          if (!existingUser) {
            console.log('Creating new user...');
            // Create new user
            const { data: newUser, error } = await supabase
              .from('users')
              .insert([
                {
                  strava_id: profile.id.toString(),
                  name: user.name,
                  email: user.email,
                  profile_picture: user.image,
                  color: '#FF1493'
                }
              ])
              .select()
              .single();

            if (error) {
              console.error('Error creating user:', error);
              return false;
            }

            console.log('User created:', newUser.id);
            user.id = newUser.id;
            user.stravaId = profile.id.toString();
          } else {
            user.id = existingUser.id;
            user.stravaId = profile.id.toString();
          }
        } catch (error) {
          console.error('SignIn callback error:', error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.stravaId = user.stravaId;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.stravaId = token.stravaId;
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to /activities after login
      if (url.startsWith(baseUrl)) {
        return `${baseUrl}/activities`;
      }
      return baseUrl;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }
};
