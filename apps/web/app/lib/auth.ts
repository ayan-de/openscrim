/* eslint-disable turbo/no-undeclared-env-vars */
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { connectToDatabase } from './mongodb';
import UserModel from './models/User';

const nextAuthResult = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'github' && profile?.id) {
        await connectToDatabase();
        const providerId = String(profile.id);
        const existingUser = await UserModel.findOne({ providerId });
        if (!existingUser) {
          const name = (profile.name as string | undefined) ?? (profile.login as string | undefined) ?? '';
          const [firstName, ...rest] = name.split(' ');
          await UserModel.create({
            email: profile.email ?? undefined,
            firstName: firstName ?? '',
            lastName: rest.join(' '),
            picture: profile.avatar_url as string | undefined,
            provider: 'github',
            providerId,
          });
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'github' && profile?.id) {
        await connectToDatabase();
        const user = await UserModel.findOne({ providerId: String(profile.id) });
        if (user) {
          token._id = user._id.toString();
          token.firstName = user.firstName;
          token.lastName = user.lastName;
          token.picture = user.picture ?? undefined;
          token.provider = user.provider;
          token.providerId = user.providerId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user._id = token._id ?? '';
        session.user.firstName = token.firstName ?? '';
        session.user.lastName = token.lastName ?? '';
        session.user.picture = token.picture;
        session.user.provider = token.provider ?? '';
        session.user.providerId = token.providerId ?? '';
      }
      return session;
    },
  },
});

export const { handlers, signOut, auth } = nextAuthResult;
export type SignInResult = void | never;
export const signIn: (
  provider: string,
  options?: Record<string, unknown>
) => Promise<SignInResult> = nextAuthResult.signIn as never;
