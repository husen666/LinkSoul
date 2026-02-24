type ThrottleRule = {
  limit: number;
  ttl: number;
};

const toPositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const makeRule = (
  limitEnv: string | undefined,
  ttlEnv: string | undefined,
  defaultLimit: number,
  defaultTtl: number,
): ThrottleRule => ({
  limit: toPositiveInt(limitEnv, defaultLimit),
  ttl: toPositiveInt(ttlEnv, defaultTtl),
});

export const ADMIN_THROTTLE = {
  deleteUser: makeRule(
    process.env.ADMIN_THROTTLE_DELETE_USER_LIMIT,
    process.env.ADMIN_THROTTLE_DELETE_USER_TTL_MS,
    5,
    60_000,
  ),
  resetPassword: makeRule(
    process.env.ADMIN_THROTTLE_RESET_PASSWORD_LIMIT,
    process.env.ADMIN_THROTTLE_RESET_PASSWORD_TTL_MS,
    10,
    60_000,
  ),
  createAdmin: makeRule(
    process.env.ADMIN_THROTTLE_CREATE_ADMIN_LIMIT,
    process.env.ADMIN_THROTTLE_CREATE_ADMIN_TTL_MS,
    5,
    60_000,
  ),
  changePassword: makeRule(
    process.env.ADMIN_THROTTLE_CHANGE_PASSWORD_LIMIT,
    process.env.ADMIN_THROTTLE_CHANGE_PASSWORD_TTL_MS,
    10,
    60_000,
  ),
  deleteAdmin: makeRule(
    process.env.ADMIN_THROTTLE_DELETE_ADMIN_LIMIT,
    process.env.ADMIN_THROTTLE_DELETE_ADMIN_TTL_MS,
    5,
    60_000,
  ),
} as const;
