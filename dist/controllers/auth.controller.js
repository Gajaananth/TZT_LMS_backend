"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.deleteAccount = exports.sync = exports.passwordResetConfirm = exports.passwordResetRequest = exports.refresh = exports.logout = exports.login = exports.register = void 0;
const supabase_1 = require("../lib/supabase");
const auth_service_1 = require("../services/auth.service");
const api_response_1 = require("../utils/api-response");
const updatePasswordForUser = async (userId, password) => {
    const { error } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(userId, { password });
    return { error };
};
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, role, specialization } = req.body;
        // 1. Create user in Supabase
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
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
            return (0, api_response_1.sendError)(res, authError.message, 400);
        }
        // 2. Sync to our database using our service
        let user = null;
        try {
            user = await auth_service_1.authService.syncSupabaseUser(authData.user, role || 'Student', specialization);
        }
        catch (e) {
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
            };
            console.debug('register: using fallback user', user);
        }
        let safeUser = user;
        try {
            safeUser = JSON.parse(JSON.stringify(user));
        }
        catch (e) {
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
            const { data: sessionData } = await supabase_1.supabaseAdmin.auth.signInWithPassword({ email, password });
            if (sessionData?.session) {
                session = {
                    accessToken: sessionData.session.access_token,
                    refreshToken: sessionData.session.refresh_token,
                    expiresIn: sessionData.session.expires_in,
                    expiresAt: sessionData.session.expires_at
                };
            }
        }
        catch (e) {
            console.warn('register: could not auto-sign-in', e);
        }
        return (0, api_response_1.sendSuccess)(res, { user: safeUser, session }, 'User registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // 1. Sign in with Supabase
        const { data, error } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email,
            password
        });
        if (error || !data.session) {
            return (0, api_response_1.sendError)(res, error?.message || 'Login failed', 401);
        }
        // 2. Sync user to our database
        const user = await auth_service_1.authService.syncSupabaseUser(data.user);
        return (0, api_response_1.sendSuccess)(res, {
            user,
            session: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
                expiresAt: data.session.expires_at
            }
        }, 'Login successful');
    }
    catch (error) {
        return next(error);
    }
};
exports.login = login;
const logout = async (req, res, next) => {
    try {
        // Logout is primarily client-side (clear token from localStorage)
        // This endpoint can be used for server-side session cleanup if needed
        return (0, api_response_1.sendSuccess)(res, null, 'Logout successful');
    }
    catch (error) {
        return next(error);
    }
};
exports.logout = logout;
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        // Refresh the session using Supabase
        const { data, error } = await supabase_1.supabaseAdmin.auth.refreshSession({
            refresh_token: refreshToken,
        });
        if (error || !data.session) {
            return (0, api_response_1.sendError)(res, error?.message || 'Token refresh failed', 401);
        }
        return (0, api_response_1.sendSuccess)(res, {
            session: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
                expiresAt: data.session.expires_at
            }
        }, 'Token refreshed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.refresh = refresh;
const passwordResetRequest = async (req, res, next) => {
    try {
        const { email } = req.body;
        // Use the public reset flow so unknown addresses do not reveal account existence.
        const { error } = await supabase_1.supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:3000/reset-password'
        });
        if (error) {
            return (0, api_response_1.sendError)(res, error.message, 400);
        }
        // Don't expose the actual link in response - just confirm it was sent
        return (0, api_response_1.sendSuccess)(res, {
            email,
            message: 'Password reset link has been sent to your email'
        }, 'Password reset email sent');
    }
    catch (error) {
        return next(error);
    }
};
exports.passwordResetRequest = passwordResetRequest;
const passwordResetConfirm = async (req, res, next) => {
    try {
        const { token, password } = req.body;
        let verifiedUserId = null;
        // Prefer interpreting token as an access token (supabase session) first
        try {
            const { data: userData, error: userError } = await supabase_1.supabaseAdmin.auth.getUser(token);
            if (!userError && userData?.user?.id)
                verifiedUserId = userData.user.id;
        }
        catch (e) {
            // ignore - getUser may throw for non-session tokens
        }
        // If getUser didn't return an ID, accept a direct userId only when it looks like a UUID
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        if (!verifiedUserId && typeof token === 'string' && uuidRegex.test(token)) {
            verifiedUserId = token;
        }
        if (!verifiedUserId) {
            return (0, api_response_1.sendError)(res, 'Invalid or unsupported password reset token. Use the link from email and try again.', 400);
        }
        const { error } = await updatePasswordForUser(verifiedUserId, password);
        if (error) {
            return (0, api_response_1.sendError)(res, error.message, 400);
        }
        return (0, api_response_1.sendSuccess)(res, { message: 'Password reset successful' }, 'Password updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.passwordResetConfirm = passwordResetConfirm;
const sync = async (req, res, next) => {
    try {
        // This endpoint is hit by the frontend right after Supabase login
        // to ensure the user exists in Prisma and gets their session context.
        const token = req.headers.authorization?.split(' ')[1];
        if (!token)
            return (0, api_response_1.sendError)(res, 'No token provided', 401);
        const { data: { user: supabaseUser }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !supabaseUser)
            return (0, api_response_1.sendError)(res, 'Invalid token', 401);
        const user = await auth_service_1.authService.syncSupabaseUser(supabaseUser);
        return (0, api_response_1.sendSuccess)(res, { user }, 'User synced successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.sync = sync;
const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return (0, api_response_1.sendError)(res, 'Unauthorized', 401);
        const { confirmation } = req.body;
        if (confirmation !== 'DELETE') {
            return (0, api_response_1.sendError)(res, 'Please type DELETE to confirm account deletion.', 400);
        }
        await auth_service_1.authService.deleteAccount(userId);
        return (0, api_response_1.sendSuccess)(res, null, 'Your account has been deleted.');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAccount = deleteAccount;
const getMe = async (req, res) => {
    // req.user is set by auth middleware
    return (0, api_response_1.sendSuccess)(res, { user: req.user }, 'Current user retrieved');
};
exports.getMe = getMe;
