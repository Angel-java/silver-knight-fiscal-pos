-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'FACT',
    "controlNumber" TEXT,
    "fiscalControlId" TEXT,
    "customerId" TEXT,
    "userId" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" DATETIME,
    "totalUsd" REAL NOT NULL,
    "totalVes" REAL NOT NULL,
    "ivaUsd" REAL NOT NULL,
    "ivaVes" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "payments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_fiscalControlId_fkey" FOREIGN KEY ("fiscalControlId") REFERENCES "FiscalControl" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("cancelReason", "cancelledAt", "controlNumber", "createdAt", "currency", "customerId", "documentType", "exchangeRate", "fiscalControlId", "id", "ivaUsd", "ivaVes", "number", "payments", "status", "totalUsd", "totalVes", "updatedAt") SELECT "cancelReason", "cancelledAt", "controlNumber", "createdAt", "currency", "customerId", "documentType", "exchangeRate", "fiscalControlId", "id", "ivaUsd", "ivaVes", "number", "payments", "status", "totalUsd", "totalVes", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_documentType_status_idx" ON "Invoice"("documentType", "status");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_fiscalControlId_idx" ON "Invoice"("fiscalControlId");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "fullName" TEXT,
    "pin" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operador',
    "permissions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "id", "isActive", "pin", "role", "updatedAt", "username") SELECT "createdAt", "id", "isActive", "pin", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
