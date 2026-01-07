import NextAuth from 'next-auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * NextAuth v4 configuration for Strava OAuth
 */

const authOptions = {
  providers: [
    {
      id: 'strava',
      name: 'Strava',
      type: 'oauth',
      authorization: {
        url: 'https://www.strava.com/oauth/authorize',
        params: {
          scope: 'read,activity:read_all',
          approval_prompt: 'auto',
          response_type: 'code'
        }
      },
      token: {
        async request(context) {
          const { provider, params, checks } = context;
          
          const body = new URLSearchParams({
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            code: params.code,
            grant_type: 'authorization_code',
          });

          const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          });

          const tokens = await response.json();
          
          if (!response.ok) {
            console.error('Strava token error:', tokens);
            throw new Error(`Strava token request failed: ${JSON.stringify(tokens)}`);
          }

          console.log('Strava tokens received:', { ...tokens, access_token: '***' });
          return { tokens };
        }
      },
      userinfo: {
        async request(context) {
          const response = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: {
              Authorization: `Bearer ${context.tokens.access_token}`,
            },
          });
          return await response.json();
        }
      },
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
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
              .insert({
                email: user.email,
                name: user.name,
                avatar_url: user.image,
                strava_id: profile.id.toString(),
                strava_access_token: account.access_token,
                strava_refresh_token: account.refresh_token,
                strava_expires_at: account.expires_at
              })
              .select()
              .single();

            if (error) {
              console.error('Failed to create user:', error);
              // Still allow sign in even if DB insert fails
            } else {
              console.log('User created successfully:', newUser.id);
            }
          } else {
            console.log('Updating existing user tokens...');
            // Update existing user tokens
            const { error } = await supabase
              .from('users')
              .update({
                strava_access_token: account.access_token,
                strava_refresh_token: account.refresh_token,
                strava_expires_at: account.expires_at,
                updated_at: new Date().toISOString()
              })
              .eq('strava_id', profile.id.toString());
              
            if (error) {
              console.error('Failed to update user:', error);
            } else {
              console.log('User updated successfully');
            }
          }
        } catch (error) {
          console.error('Database error during sign in:', error);
          // Don't block sign in on database errors
        }
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account && profile) {
        console.log('JWT callback - fetching user for Strava ID:', profile.id.toString());
        
        // Get the user's database ID
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('id')
          .eq('strava_id', profile.id.toString())
          .single();

        if (error) {
          console.error('Error fetching user in JWT callback:', error);
        }

        if (dbUser) {
          console.log('Found user ID:', dbUser.id);
          token.userId = dbUser.id; // Database UUID
          token.stravaId = profile.id.toString();
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        } else {
          console.error('User not found in database after sign in!');
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId; // Use database UUID
        session.user.stravaId = token.stravaId;
      }
      session.accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: '/'
  },  redirect: async ({ url, baseUrl }) => {
    // Redirect to activities after successful login
    if (url === baseUrl || url === baseUrl + '/') {
      return '/activities';
    }
    return url;
  },  session: {
    strategy: 'jwt'
  },
  secret: process.env.AUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST, authOptions };
