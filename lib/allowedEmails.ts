export class ForbiddenEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenEmailError";
  }
}

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertEmailAllowed(email: string | undefined) {
  const allowedEmails = getAllowedEmails();

  if (allowedEmails.length === 0) {
    throw new Error("Missing ALLOWED_EMAILS in environment variables.");
  }

  if (!email || !allowedEmails.includes(email.toLowerCase())) {
    throw new ForbiddenEmailError("当前账号不允许使用 AI 解析。");
  }
}
