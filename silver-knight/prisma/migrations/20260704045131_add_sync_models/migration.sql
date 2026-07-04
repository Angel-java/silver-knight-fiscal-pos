/*
  Warnings:

  - Added the required column `updatedAt` to the `CashRegister` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `InvoiceItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SyncConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "interval" INTEGER NOT NULL DEFAULT 60,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CashRegister" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openedBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "openingUsd" REAL NOT NULL,
    "openingVes" REAL NOT NULL,
    "closingUsd" REAL,
    "closingVes" REAL,
    "salesUsd" REAL NOT NULL DEFAULT 0,
    "salesVes" REAL NOT NULL DEFAULT 0,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CashRegister" ("closedAt", "closedBy", "closingUsd", "closingVes", "id", "isOpen", "openedAt", "openedBy", "openingUsd", "openingVes", "salesUsd", "salesVes") SELECT "closedAt", "closedBy", "closingUsd", "closingVes", "id", "isOpen", "openedAt", "openedBy", "openingUsd", "openingVes", "salesUsd", "salesVes" FROM "CashRegister";
DROP TABLE "CashRegister";
ALTER TABLE "new_CashRegister" RENAME TO "CashRegister";
CREATE TABLE "new_ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ExchangeRate" ("createdAt", "date", "id", "rate", "source") SELECT "createdAt", "date", "id", "rate", "source" FROM "ExchangeRate";
DROP TABLE "ExchangeRate";
ALTER TABLE "new_ExchangeRate" RENAME TO "ExchangeRate";
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPriceUsd" REAL NOT NULL,
    "unitPriceVes" REAL NOT NULL,
    "ivaRate" REAL NOT NULL,
    "totalUsd" REAL NOT NULL,
    "totalVes" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("id", "invoiceId", "ivaRate", "productId", "productName", "quantity", "totalUsd", "totalVes", "unitPriceUsd", "unitPriceVes") SELECT "id", "invoiceId", "ivaRate", "productId", "productName", "quantity", "totalUsd", "totalVes", "unitPriceUsd", "unitPriceVes" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Setting" ("id", "key", "value") SELECT "id", "key", "value" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
