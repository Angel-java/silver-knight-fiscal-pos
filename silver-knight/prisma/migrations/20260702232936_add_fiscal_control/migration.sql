-- CreateTable
CREATE TABLE "FiscalControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "startNumber" INTEGER NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("controlNumber", "createdAt", "currency", "customerId", "exchangeRate", "id", "ivaUsd", "ivaVes", "number", "payments", "status", "totalUsd", "totalVes", "updatedAt") SELECT "controlNumber", "createdAt", "currency", "customerId", "exchangeRate", "id", "ivaUsd", "ivaVes", "number", "payments", "status", "totalUsd", "totalVes", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FiscalControl_documentType_prefix_key" ON "FiscalControl"("documentType", "prefix");
