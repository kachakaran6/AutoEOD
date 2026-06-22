-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "chatgptCaptureContent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExtensionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Browser Extension',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionToken_tokenHash_key" ON "ExtensionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ExtensionToken_userId_idx" ON "ExtensionToken"("userId");

-- AddForeignKey
ALTER TABLE "ExtensionToken" ADD CONSTRAINT "ExtensionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
