-- Outlet branding: uploaded UMKM logo (bytes + mime) and a version
-- counter that cache-busts /api/outlet/logo after every change.
ALTER TABLE "Outlet" ADD COLUMN "logoData" BYTEA;
ALTER TABLE "Outlet" ADD COLUMN "logoMimeType" TEXT;
ALTER TABLE "Outlet" ADD COLUMN "logoVersion" INTEGER NOT NULL DEFAULT 0;
