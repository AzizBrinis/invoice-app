import "nodemailer/lib/mailer";

declare module "nodemailer/lib/mailer" {
  interface Options {
    /**
     * Retain Bcc header when generating the raw message payload.
     */
    keepBcc?: boolean;
  }
}
