import { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authService } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/api-response';

const updatePasswordForUser = async (userId: string, password: string) => {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  return { error };
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role, specialization } = req.body;

    // 1. Create user in Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    console.debug('register: supabase createUser response', { authData, authError });

    if (authError) {
      console.warn('register: supabase createUser returned error', authError);
      return sendError(res, authError.message, 400);
    }

    // 2. Sync to our database using our service
    let user = null;
    try {
      user = await authService.syncSupabaseUser(authData.user, role || 'Student', specialization);
    } catch (e) {
      console.error('syncSupabaseUser failed during register:', e);
    }

    // Ensure we always return a consistent user shape for clients/tests
    if (!user) {
      const fallbackRole = { role: { id: 'role-fallback', name: role || 'Student' } };
      user = {
        id: authData.user.id,
        supabaseUserId: authData.user.id,
        email: authData.user.email,
        firstName: authData.user.user_metadata?.first_name || authData.user.user_metadata?.firstName || '',
        lastName: authData.user.user_metadata?.last_name || authData.user.user_metadata?.lastName || '',
        userRoles: [fallbackRole],
      } as any;
      console.debug('register: using fallback user', user);
    }

    let safeUser = user;
    try {
      safeUser = JSON.parse(JSON.stringify(user));
    } catch (e) {
      console.warn('register: user not JSON-serializable, falling back to minimal shape', e);
      safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userRoles: user.userRoles || []
      };
    }

    console.debug('register: returning user to client (safe)', { safeUser });

    // 3. Automatically sign in to get active session
    let session = null;
    try {
      const { data: sessionData } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (sessionData?.session) {
        session = {
          accessToken: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
          expiresIn: sessionData.session.expires_in,
          expiresAt: sessionData.session.expires_at
        };
      }
    } catch (e) {
      console.warn('register: could not auto-sign-in', e);
    }

    return sendSuccess(res, { user: safeUser, session }, 'User registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // 1. Sign in with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      return sendError(res, error?.message || 'Login failed', 401);
    }

    // 2. Sync user to our database
    const user = await authService.syncSupabaseUser(data.user);

    return sendSuccess(res, {
      user,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at
      }
    }, 'Login successful');
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Logout is primarily client-side (clear token from localStorage)
    // This endpoint can be used for server-side session cleanup if needed
    return sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    // Refresh the session using Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    } as any);

    if (error || !data.session) {
      return sendError(res, error?.message || 'Token refresh failed', 401);
    }

    return sendSuccess(res, {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at
      }
    }, 'Token refreshed successfully');
  } catch (error) {
    return next(error);
  }
};

export const passwordResetRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    // Use the public reset flow so unknown addresses do not reveal account existence.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:3000/reset-password'
    });

    if (error) {
      return sendError(res, error.message, 400);
    }

    // Don't expose the actual link in response - just confirm it was sent
    return sendSuccess(res, {
      email,
      message: 'Password reset link has been sent to your email'
    }, 'Password reset email sent');
  } catch (error) {
    return next(error);
  }
};

export const passwordResetConfirm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;

    let verifiedUserId: string | null = null;
    // Prefer interpreting token as an access token (supabase session) first
    try {
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && userData?.user?.id) verifiedUserId = userData.user.id;
    } catch (e) {
      // ignore - getUser may throw for non-session tokens
    }

    // If getUser didn't return an ID, accept a direct userId only when it looks like a UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!verifiedUserId && typeof token === 'string' && uuidRegex.test(token)) {
      verifiedUserId = token;
    }

    if (!verifiedUserId) {
      return sendError(res, 'Invalid or unsupported password reset token. Use the link from email and try again.', 400);
    }

    const { error } = await updatePasswordForUser(verifiedUserId, password);
    if (error) {
      return sendError(res, error.message, 400);
    }

    return sendSuccess(res, { message: 'Password reset successful' }, 'Password updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const sync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This endpoint is hit by the frontend right after Supabase login
    // to ensure the user exists in Prisma and gets their session context.
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return sendError(res, 'No token provided', 401);

    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !supabaseUser) return sendError(res, 'Invalid token', 401);

    const user = await authService.syncSupabaseUser(supabaseUser);
    
    return sendSuccess(res, { user }, 'User synced successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return sendError(res, 'Please type DELETE to confirm account deletion.', 400);
    }

    await authService.deleteAccount(userId);

    return sendSuccess(res, null, 'Your account has been deleted.');
  } catch (error) {
    return next(error);
  }
};

export const getMe = async (req: Request, res: Response) => {
  // req.user is set by auth middleware
  return sendSuccess(res, { user: req.user }, 'Current user retrieved');
};
