export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export function normalizeOptionalString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normalizePhoneStrict(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[()\-\s]/g, "");
  return s.length ? s : null;
}

function isE164(v) {
  return typeof v === "string" && /^\+[1-9]\d{7,14}$/.test(v);
}

function normalizeTelegram(v) {
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  if (s.startsWith("@")) s = s.slice(1);
  return s;
}

function isTelegramUsername(v) {
  // Telegram: 5-32 chars, letters/digits/underscore. Cannot start/end underscore. No double underscore.
  if (typeof v !== "string") return false;
  if (v.length < 5 || v.length > 32) return false;
  if (!/^[A-Za-z0-9_]+$/.test(v)) return false;
  if (v.startsWith("_") || v.endsWith("_")) return false;
  if (v.includes("__")) return false;
  return true;
}

function isEmailLooseStrict(v) {
  if (typeof v !== "string") return false;
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function isUsernameStrict(v) {
  // 3-24 chars, letters/digits/underscore only.
  if (typeof v !== "string") return false;
  if (v.length < 3 || v.length > 24) return false;
  return /^[A-Za-z0-9_]+$/.test(v);
}

export { normalizePhoneStrict, isE164, normalizeTelegram, isTelegramUsername };

function isStrongPassword(v) {
  // >= 8, at least 1 letter and 1 number.
  if (typeof v !== "string") return false;
  if (v.trim().length < 8) return false;
  return /[A-Za-z]/.test(v) && /\d/.test(v);
}

export function validateSignup(body, opts = {}) {
  const errors = [];
  const reserved = opts.reservedUsernames instanceof Set ? opts.reservedUsernames : new Set();

  const usernameRaw = body?.username;
  const emailRaw = body?.email;
  const mobileRaw = body?.mobileNumber;
  const whatsappRaw = body?.whatsappNumber;
  const telegramRaw = body?.telegramUsername;
  const passwordRaw = body?.password;

  const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
  const email = normalizeOptionalString(emailRaw);
  const mobileNumber = normalizePhoneStrict(mobileRaw);
  const whatsappNumber = normalizePhoneStrict(whatsappRaw);
  const telegramCore = normalizeTelegram(telegramRaw);
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!username) errors.push({ field: "username", message: "Required" });
  if (username && !isUsernameStrict(username)) {
    errors.push({ field: "username", message: "3-24 chars: letters, numbers, underscore only" });
  }
  if (username && reserved.has(username.toLowerCase())) {
    errors.push({ field: "username", message: "Reserved username" });
  }

  if (!mobileNumber) errors.push({ field: "mobileNumber", message: "Required" });
  if (mobileNumber && !isE164(mobileNumber)) {
    errors.push({ field: "mobileNumber", message: "Use E.164 format like +919876543210" });
  }

  if (whatsappNumber && !isE164(whatsappNumber)) {
    errors.push({ field: "whatsappNumber", message: "Use E.164 format like +919876543210" });
  }

  if (email && !isEmailLooseStrict(email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }

  if (telegramCore && !isTelegramUsername(telegramCore)) {
    errors.push({
      field: "telegramUsername",
      message: "Telegram username: 5-32 chars, letters/numbers/underscore",
    });
  }

  if (!isStrongPassword(password)) {
    errors.push({ field: "password", message: "Min 8 chars, include 1 letter and 1 number" });
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      username,
      email,
      mobileNumber: mobileNumber ?? "",
      whatsappNumber: whatsappNumber ? whatsappNumber : null,
      telegramUsername: telegramCore ? `@${telegramCore}` : null,
      password,
    },
  };
}

export function validateAdminUserUpdate(body) {
  const errors = [];
  const raw = body && typeof body === "object" ? body : {};
  const hasEmail = Object.prototype.hasOwnProperty.call(raw, "email");
  const hasWhatsapp = Object.prototype.hasOwnProperty.call(raw, "whatsappNumber");
  const hasTelegram = Object.prototype.hasOwnProperty.call(raw, "telegramUsername");
  const hasStatus = Object.prototype.hasOwnProperty.call(raw, "status");
  const hasMobile = Object.prototype.hasOwnProperty.call(raw, "mobileNumber");

  const emailRaw = hasEmail && typeof raw.email === "string" ? raw.email : "";
  const email = normalizeOptionalString(emailRaw);
  if (hasEmail && email && !isEmailLooseStrict(email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }

  const mobileRaw =
    hasMobile && typeof raw.mobileNumber === "string" ? raw.mobileNumber.trim() : "";
  const mobileNumber = mobileRaw ? normalizePhoneStrict(mobileRaw) : null;
  if (!hasMobile || !mobileRaw) {
    errors.push({ field: "mobileNumber", message: "Required" });
  } else if (!mobileNumber || !isE164(mobileNumber)) {
    errors.push({
      field: "mobileNumber",
      message: "Use E.164 format like +919876543210",
    });
  }

  const whatsappRaw =
    hasWhatsapp && typeof raw.whatsappNumber === "string" ? raw.whatsappNumber.trim() : "";
  const whatsappNumber = whatsappRaw ? normalizePhoneStrict(whatsappRaw) : null;
  if (hasWhatsapp && whatsappRaw && (!whatsappNumber || !isE164(whatsappNumber))) {
    errors.push({
      field: "whatsappNumber",
      message: "Use E.164 format like +919876543210",
    });
  }

  const telegramRaw =
    hasTelegram && typeof raw.telegramUsername === "string" ? raw.telegramUsername.trim() : "";
  const telegramCore = telegramRaw ? normalizeTelegram(telegramRaw) : null;
  if (hasTelegram && telegramRaw && (!telegramCore || !isTelegramUsername(telegramCore))) {
    errors.push({
      field: "telegramUsername",
      message: "Telegram: 5-32 chars, letters/numbers/underscore",
    });
  }

  const statusRaw =
    hasStatus && typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  const allowedStatuses = new Set(["pending", "approved", "rejected"]);
  let statusValue;
  if (hasStatus) {
    if (!statusRaw) {
      errors.push({ field: "status", message: "Invalid status" });
    } else if (!allowedStatuses.has(statusRaw)) {
      errors.push({ field: "status", message: "Invalid status" });
    } else {
      statusValue = statusRaw;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      email: hasEmail ? email : undefined,
      mobileNumber: mobileNumber ?? null,
      whatsappNumber: hasWhatsapp ? (whatsappRaw ? whatsappNumber : null) : undefined,
      telegramUsername: hasTelegram
        ? telegramRaw
          ? telegramCore
            ? `@${telegramCore}`
            : null
          : null
        : undefined,
      status: statusValue,
    },
  };
}

export function validateAdminLogin(body) {
  const errors = [];
  const username = isNonEmptyString(body?.username) ? body.username.trim() : "";
  const password = isNonEmptyString(body?.password) ? body.password : "";

  if (!username) errors.push({ field: "username", message: "Required" });
  if (!password) errors.push({ field: "password", message: "Required" });

  return { ok: errors.length === 0, errors, value: { username, password } };
}

export function validateNewPassword(body) {
  const errors = [];
  const token = isNonEmptyString(body?.token) ? body.token.trim() : "";
  const password = isNonEmptyString(body?.newPassword) ? body.newPassword : "";

  if (!token) errors.push({ field: "token", message: "Required" });
  if (!isStrongPassword(password)) {
    errors.push({ field: "newPassword", message: "Min 8 chars, include 1 letter and 1 number" });
  }

  return { ok: errors.length === 0, errors, value: { token, newPassword: password } };
}

function isSlug(v) {
  if (typeof v !== "string") return false;
  if (v.length < 3 || v.length > 80) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
}

function normalizeSlug(v) {
  if (typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

function normalizeTags(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    if (typeof t !== "string") continue;
    const s = t.trim().toLowerCase();
    if (!s) continue;
    if (s.length > 24) continue;
    if (!/^[a-z0-9_-]+$/.test(s)) continue;
    out.push(s);
  }
  return Array.from(new Set(out)).slice(0, 20);
}

export function validateBlogUpsert(body) {
  const errors = [];

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = normalizeSlug(body?.slug);
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";
  const contentMarkdown = typeof body?.contentMarkdown === "string" ? body.contentMarkdown : "";
  const coverImageUrl = typeof body?.coverImageUrl === "string" ? body.coverImageUrl.trim() : "";
  const tags = normalizeTags(body?.tags);
  const published = typeof body?.published === "boolean" ? body.published : false;
  const newsletter = Boolean(body?.newsletter);

  if (!title) errors.push({ field: "title", message: "Required" });
  if (title && title.length > 120) errors.push({ field: "title", message: "Max 120 chars" });

  if (slug && !isSlug(slug))
    errors.push({ field: "slug", message: "Slug must be lowercase with hyphens (a-z, 0-9, -)" });

  if (excerpt && excerpt.length > 240) errors.push({ field: "excerpt", message: "Max 240 chars" });

  if (!contentMarkdown || contentMarkdown.trim().length < 10) {
    errors.push({ field: "contentMarkdown", message: "Min 10 characters" });
  }
  if (contentMarkdown && contentMarkdown.length > 200000) {
    errors.push({ field: "contentMarkdown", message: "Too large" });
  }

  if (coverImageUrl && coverImageUrl.length > 400)
    errors.push({ field: "coverImageUrl", message: "Too long" });

  return {
    ok: errors.length === 0,
    errors,
    value: {
      title,
      slug,
      excerpt,
      contentMarkdown,
      coverImageUrl: coverImageUrl || null,
      tags,
      published,
      newsletter,
    },
  };
}
