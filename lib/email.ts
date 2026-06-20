type EmailInput = { to: string; subject: string; text: string };

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  if (!emailConfigured()) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...input }),
  });
  if (!response.ok) {
    console.error("Email delivery failed:", response.status);
    return false;
  }
  return true;
}

