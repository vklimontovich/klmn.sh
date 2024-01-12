import { Resend } from "resend";

export const resend: Resend | undefined = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : undefined;
