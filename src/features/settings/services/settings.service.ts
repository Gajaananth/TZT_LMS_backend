import { prisma } from '@/db/prisma/client';

const KNOWN_GROUPS = ['general', 'appearance', 'integrations'] as const;
type SettingGroup = typeof KNOWN_GROUPS[number];

const GROUP_PREFIXES: Record<SettingGroup, string[]> = {
  general: ['general.', 'site.', 'app.', 'system.'],
  appearance: ['appearance.', 'theme.', 'ui.', 'branding.'],
  integrations: ['integrations.', 'smtp.', 'sms.', 'stripe.', 'supabase.', 'payment.', 'storage.'],
};

const isGroupMatch = (key: string, group?: SettingGroup | string): boolean => {
  if (!group) return true;
  const prefixes = GROUP_PREFIXES[group as SettingGroup];
  if (!prefixes) return true;
  return prefixes.some((p) => key.toLowerCase().startsWith(p.toLowerCase()));
};

const DEFAULT_INTEGRATION_KEYS: Record<string, { label: string; description: string; placeholder?: string; isSecret?: boolean }> = {
  'integrations.smtp.host': { label: 'SMTP Host', description: 'Outgoing mail server host' },
  'integrations.smtp.port': { label: 'SMTP Port', description: 'Port (e.g., 587 for TLS)' },
  'integrations.smtp.user': { label: 'SMTP Username', description: 'SMTP auth username' },
  'integrations.smtp.pass': { label: 'SMTP Password', description: 'SMTP auth password', isSecret: true },
  'integrations.sms.provider': { label: 'SMS Provider', description: 'e.g., Twilio, Plivo' },
  'integrations.sms.apiKey': { label: 'SMS API Key', description: 'Provider API key', isSecret: true },
  'integrations.stripe.publishableKey': { label: 'Stripe Publishable Key', description: 'Public key' },
  'integrations.stripe.secretKey': { label: 'Stripe Secret Key', description: 'Server-side secret key', isSecret: true },
  'integrations.storage.bucket': { label: 'Storage Bucket', description: 'Default bucket name for uploads' },
};

const DEFAULT_GENERAL_KEYS: Record<string, { label: string; description: string; value?: string }> = {
  'general.siteName': { label: 'Site Name', description: 'Name displayed in headers & emails', value: 'TZIT Education ERP & LMS' },
  'general.siteTagline': { label: 'Site Tagline', description: 'Short tagline shown below site name', value: 'Learning Management System' },
  'general.supportEmail': { label: 'Support Email', description: 'Contact email for users', value: 'support@tzit.edu' },
  'general.defaultLanguage': { label: 'Default Language', description: 'ISO 639-1 code', value: 'en' },
  'general.timezone': { label: 'Default Timezone', description: 'IANA timezone identifier', value: 'UTC' },
  'general.enableRegistration': { label: 'Enable Self-Registration', description: 'Allow users to create accounts', value: 'true' },
  'general.termsOfServiceUrl': { label: 'Terms of Service URL', description: 'Public link' },
  'general.privacyPolicyUrl': { label: 'Privacy Policy URL', description: 'Public link' },
};

const DEFAULT_APPEARANCE_KEYS: Record<string, { label: string; description: string; value?: string }> = {
  'appearance.primaryColor': { label: 'Primary Color (Hex)', description: 'e.g., #6366f1 (indigo)', value: '#6366f1' },
  'appearance.secondaryColor': { label: 'Secondary Color (Hex)', description: 'e.g., #06b6d4 (cyan)', value: '#06b6d4' },
  'appearance.accentColor': { label: 'Accent Color (Hex)', description: 'e.g., #10b981 (emerald)', value: '#10b981' },
  'appearance.logoUrl': { label: 'Logo URL', description: 'Square logo (prefer SVG or transparent PNG)' },
  'appearance.faviconUrl': { label: 'Favicon URL', description: '32x32 or SVG' },
  'appearance.darkModeDefault': { label: 'Dark Mode by Default', description: 'Show dark theme for new visitors', value: 'true' },
  'appearance.customCss': { label: 'Custom CSS', description: 'Extra styles applied site-wide' },
  'appearance.footerText': { label: 'Footer Copyright Text', description: 'Plain text, supports {year}' , value: `© ${new Date().getFullYear()} TZIT Education. All rights reserved.`},
};

export interface FlatSetting {
  key: string;
  value: string;
  description?: string | null;
  label?: string;
  placeholder?: string;
  isSecret?: boolean;
  configured?: boolean;
}

const seedMissingWithDefaults = async (userId?: string): Promise<void> => {
  const allDefaults: Record<string, { label: string; description: string; value?: string; isSecret?: boolean; placeholder?: string }> = {
    ...DEFAULT_GENERAL_KEYS,
    ...DEFAULT_APPEARANCE_KEYS,
    ...DEFAULT_INTEGRATION_KEYS,
  };
  const existing = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(allDefaults) } },
    select: { key: true, value: true },
  });
  const existingKeys = new Set(existing.map((s) => s.key));
  const missing = Object.entries(allDefaults).filter(([k]) => !existingKeys.has(k));
  if (missing.length === 0) return;
  const now = new Date();
  await prisma.systemSetting.createMany({
    data: missing.map(([key, meta]) => ({
      key,
      value: meta.value ?? '',
      description: meta.description,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    })),
    skipDuplicates: true,
  });
};

export class SettingsService {
  static async listSettings(group?: string, userId?: string): Promise<{ group: string | 'all'; items: FlatSetting[] }> {
    await seedMissingWithDefaults(userId);
    const rows = await prisma.systemSetting.findMany({
      where: { deletedAt: null },
      orderBy: { key: 'asc' },
    });

    const allDefaults: Record<string, { label: string; description: string; value?: string; isSecret?: boolean; placeholder?: string }> = {
      ...DEFAULT_GENERAL_KEYS,
      ...DEFAULT_APPEARANCE_KEYS,
      ...DEFAULT_INTEGRATION_KEYS,
    };

    const items: FlatSetting[] = rows
      .filter((r) => isGroupMatch(r.key, group))
      .map((r) => {
        const meta = allDefaults[r.key];
        const trimmed = (r.value || '').trim();
        return {
          key: r.key,
          value: meta?.isSecret ? (trimmed ? '●●●●●●●●' : '') : r.value,
          description: r.description || meta?.description || null,
          label: meta?.label || r.key,
          placeholder: meta?.placeholder,
          isSecret: !!meta?.isSecret,
          configured: !!trimmed,
        };
      });

    return { group: group || 'all', items };
  }

  static async bulkUpdateSettings(
    records: Array<{ key: string; value: string }>,
    userId: string,
  ): Promise<{ updated: number; keys: string[] }> {
    if (!Array.isArray(records)) throw new Error('Records must be an array');
    const now = new Date();
    const updatedKeys: string[] = [];
    let count = 0;
    for (const rec of records) {
      if (!rec || typeof rec.key !== 'string') continue;
      const existing = await prisma.systemSetting.findUnique({ where: { key: rec.key } });
      const value = rec.value ?? '';
      const wasMasked = /^●+$/.test(value);
      if (wasMasked) continue;
      if (existing) {
        await prisma.systemSetting.update({
          where: { key: rec.key },
          data: { value, updatedAt: now, updatedBy: userId },
        });
      } else {
        await prisma.systemSetting.create({
          data: { key: rec.key, value, description: '', createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId },
        });
      }
      updatedKeys.push(rec.key);
      count += 1;
    }
    return { updated: count, keys: updatedKeys };
  }

  static async listRolesWithPermissions() {
    const roles = await prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: {
          where: { deletedAt: null },
          include: { permission: true },
        },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.rolePermissions
        .filter((rp) => rp.permission && !rp.permission.deletedAt)
        .map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description,
        })),
    }));
  }

  static async listUsersWithRoles(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [total, users] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.findMany({
        where: { deletedAt: null },
        take: limit,
        skip,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          userRoles: {
            where: { deletedAt: null },
            include: { role: { select: { id: true, name: true, description: true } } },
          },
        },
      }),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        avatarUrl: u.avatarUrl,
        roles: u.userRoles
          .filter((ur) => ur.role)
          .map((ur) => ({ id: ur.role.id, name: ur.role.name, assignedAt: ur.assignedAt })),
      })),
    };
  }

  static async assignUserRoles(targetUserId: string, roleIds: string[], assignedByUserId: string) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error('User not found');

    const existingSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: targetUserId, role: { name: 'SuperAdmin' }, deletedAt: null },
      include: { role: { select: { id: true, name: true } } },
    });
    const callerIsSuperAdmin = await prisma.userRole.findFirst({
      where: { userId: assignedByUserId, role: { name: 'SuperAdmin' }, deletedAt: null },
    });
    if (existingSuperAdmin && !callerIsSuperAdmin && !roleIds.includes(existingSuperAdmin.roleId)) {
      throw new Error('Only SuperAdmin can remove SuperAdmin role');
    }

    if (!Array.isArray(roleIds)) throw new Error('roleIds must be an array');

    const validRoles = await prisma.role.findMany({
      where: { id: { in: roleIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    const validIds = new Set(validRoles.map((r) => r.id));

    const result = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: targetUserId, deletedAt: null },
      });
      const now = new Date();
      const rows = roleIds
        .filter((rid) => validIds.has(rid))
        .map((roleId, i) => ({
          userId: targetUserId,
          roleId,
          assignedAt: now,
          assignedBy: assignedByUserId,
          createdAt: now,
          updatedAt: now,
        }));
      if (rows.length > 0) {
        await tx.userRole.createMany({ data: rows, skipDuplicates: true });
      }
      return rows.length;
    });

    return { userId: targetUserId, rolesAssigned: result };
  }
}

export default SettingsService;
