
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "emailFrom" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "resendApiKeyEncrypted" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vapidPrivateKeyEncrypted" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vapidPublicKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vapidSubject" TEXT NOT NULL DEFAULT '';

