-- All Nepal Healthy Home - reconciled MySQL 8/MariaDB-compatible schema
-- Generated from the project's EF Core model and complete migration history.
-- Apply against the configured allnepalhealthy database with a MySQL client.
-- Existing canonical equivalents: access_roles=roles; customers/staff_users=users/employees;
-- pharmacy_orders/order_items=sales/sale_items; inventory=product_batches;
-- system_settings=site_settings; website_assets=hero_slides; homepage_sections=trust content;
-- role_sidebar_menu_items=role_sidebar_menu; activity_logs=audit_logs;
-- business_expenses=expenses. These are intentionally not duplicated.
SET NAMES utf8mb4;
SET time_zone = '+05:45';

CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;
DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260908032241_InitialCreate') THEN

    ALTER DATABASE CHARACTER SET utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260908032241_InitialCreate') THEN

    CREATE TABLE `system_checks` (
        `Id` int NOT NULL AUTO_INCREMENT,
        `Name` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_system_checks` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260908032241_InitialCreate') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260908032241_InitialCreate', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `branches` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Address` longtext CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_branches` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `brands` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Slug` varchar(180) CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_brands` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `categories` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Slug` varchar(180) CHARACTER SET utf8mb4 NOT NULL,
        `Description` longtext CHARACTER SET utf8mb4 NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_categories` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `customers` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `FullName` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Email` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Phone` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `PasswordHash` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_customers` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `manufacturers` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Country` varchar(120) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_manufacturers` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `addresses` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Label` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Province` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `District` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Municipality` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Ward` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `StreetTole` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Landmark` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Phone` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `IsDefault` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_addresses` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_addresses_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `carts` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_carts` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_carts_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `notifications` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Type` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Body` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
        `ReadAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_notifications` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_notifications_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `prescriptions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `OriginalFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
        `StoredFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
        `ContentType` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `FileSizeBytes` bigint NOT NULL,
        `FileSha256` varchar(64) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `OcrProvider` varchar(80) CHARACTER SET utf8mb4 NULL,
        `OcrStatus` varchar(80) CHARACTER SET utf8mb4 NULL,
        `OcrText` longtext CHARACTER SET utf8mb4 NULL,
        `CustomerNote` longtext CHARACTER SET utf8mb4 NULL,
        `SubmittedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_prescriptions` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_prescriptions_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `medicines` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `GenericName` varchar(200) CHARACTER SET utf8mb4 NULL,
        `Strength` varchar(80) CHARACTER SET utf8mb4 NULL,
        `DosageForm` varchar(80) CHARACTER SET utf8mb4 NULL,
        `Description` longtext CHARACTER SET utf8mb4 NULL,
        `Uses` longtext CHARACTER SET utf8mb4 NULL,
        `Warnings` longtext CHARACTER SET utf8mb4 NULL,
        `SideEffects` longtext CHARACTER SET utf8mb4 NULL,
        `StorageInformation` longtext CHARACTER SET utf8mb4 NULL,
        `PrescriptionRequired` tinyint(1) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CategoryId` char(36) COLLATE ascii_general_ci NULL,
        `ManufacturerId` char(36) COLLATE ascii_general_ci NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_medicines` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_medicines_categories_CategoryId` FOREIGN KEY (`CategoryId`) REFERENCES `categories` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_medicines_manufacturers_ManufacturerId` FOREIGN KEY (`ManufacturerId`) REFERENCES `manufacturers` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `pharmacy_orders` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PrescriptionId` char(36) COLLATE ascii_general_ci NULL,
        `AddressId` char(36) COLLATE ascii_general_ci NULL,
        `OrderNumber` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `PaymentStatus` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Total` decimal(12,2) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_pharmacy_orders` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_pharmacy_orders_addresses_AddressId` FOREIGN KEY (`AddressId`) REFERENCES `addresses` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_pharmacy_orders_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_pharmacy_orders_prescriptions_PrescriptionId` FOREIGN KEY (`PrescriptionId`) REFERENCES `prescriptions` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `prescription_extracted_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PrescriptionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `DetectedName` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `NormalizedName` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Strength` varchar(80) CHARACTER SET utf8mb4 NULL,
        `DosageForm` varchar(80) CHARACTER SET utf8mb4 NULL,
        `Quantity` int NULL,
        `Frequency` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Duration` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Instructions` longtext CHARACTER SET utf8mb4 NULL,
        `CustomerEdited` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_prescription_extracted_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_prescription_extracted_items_prescriptions_PrescriptionId` FOREIGN KEY (`PrescriptionId`) REFERENCES `prescriptions` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `prescription_reviews` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PrescriptionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Status` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Notes` longtext CHARACTER SET utf8mb4 NULL,
        `ReviewerId` varchar(120) CHARACTER SET utf8mb4 NULL,
        `ReviewedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_prescription_reviews` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_prescription_reviews_prescriptions_PrescriptionId` FOREIGN KEY (`PrescriptionId`) REFERENCES `prescriptions` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `products` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Slug` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Sku` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Mrp` decimal(12,2) NOT NULL,
        `SellingPrice` decimal(12,2) NOT NULL,
        `ImageUrl` longtext CHARACTER SET utf8mb4 NULL,
        `IsFeatured` tinyint(1) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `MedicineId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BrandId` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_products` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_products_brands_BrandId` FOREIGN KEY (`BrandId`) REFERENCES `brands` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_products_medicines_MedicineId` FOREIGN KEY (`MedicineId`) REFERENCES `medicines` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `order_status_history` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Status` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Note` longtext CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_order_status_history` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_order_status_history_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `cart_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CartId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Quantity` int NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_cart_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_cart_items_carts_CartId` FOREIGN KEY (`CartId`) REFERENCES `carts` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_cart_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `inventory` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NOT NULL,
        `StockQuantity` int NOT NULL,
        `ReservedQuantity` int NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_inventory` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_inventory_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_inventory_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `order_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductName` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Quantity` int NOT NULL,
        `UnitPrice` decimal(12,2) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_order_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_order_items_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_order_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `prescription_medicine_matches` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PrescriptionExtractedItemId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NULL,
        `Confidence` decimal(5,2) NOT NULL,
        `MatchType` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Availability` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `StockQuantity` int NOT NULL,
        `NeedsPharmacistReview` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_prescription_medicine_matches` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_prescription_medicine_matches_prescription_extracted_items_P~` FOREIGN KEY (`PrescriptionExtractedItemId`) REFERENCES `prescription_extracted_items` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_prescription_medicine_matches_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE TABLE `wishlist_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_wishlist_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_wishlist_items_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_wishlist_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_addresses_CustomerId` ON `addresses` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_brands_Slug` ON `brands` (`Slug`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_cart_items_CartId_ProductId` ON `cart_items` (`CartId`, `ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_cart_items_ProductId` ON `cart_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_carts_CustomerId` ON `carts` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_categories_Slug` ON `categories` (`Slug`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_customers_Email` ON `customers` (`Email`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_customers_Phone` ON `customers` (`Phone`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_inventory_BranchId` ON `inventory` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_inventory_ProductId_BranchId` ON `inventory` (`ProductId`, `BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_medicines_CategoryId` ON `medicines` (`CategoryId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_medicines_GenericName` ON `medicines` (`GenericName`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_medicines_ManufacturerId` ON `medicines` (`ManufacturerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_medicines_Name` ON `medicines` (`Name`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_notifications_CustomerId_CreatedAt` ON `notifications` (`CustomerId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_order_items_OrderId` ON `order_items` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_order_items_ProductId` ON `order_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_order_status_history_OrderId` ON `order_status_history` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_pharmacy_orders_AddressId` ON `pharmacy_orders` (`AddressId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_pharmacy_orders_CustomerId` ON `pharmacy_orders` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_pharmacy_orders_OrderNumber` ON `pharmacy_orders` (`OrderNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_pharmacy_orders_PrescriptionId` ON `pharmacy_orders` (`PrescriptionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_prescription_extracted_items_PrescriptionId` ON `prescription_extracted_items` (`PrescriptionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_prescription_medicine_matches_PrescriptionExtractedItemId` ON `prescription_medicine_matches` (`PrescriptionExtractedItemId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_prescription_medicine_matches_ProductId` ON `prescription_medicine_matches` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_prescription_reviews_PrescriptionId` ON `prescription_reviews` (`PrescriptionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_prescriptions_CustomerId_CreatedAt` ON `prescriptions` (`CustomerId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_products_BrandId` ON `products` (`BrandId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_products_MedicineId` ON `products` (`MedicineId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_products_Sku` ON `products` (`Sku`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_products_Slug` ON `products` (`Slug`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE UNIQUE INDEX `IX_wishlist_items_CustomerId_ProductId` ON `wishlist_items` (`CustomerId`, `ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    CREATE INDEX `IX_wishlist_items_ProductId` ON `wishlist_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909200514_PharmacyPhaseOne') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260909200514_PharmacyPhaseOne', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `pharmacy_orders` ADD `DeliveryFee` decimal(12,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `pharmacy_orders` ADD `DeliveryInstructions` varchar(1000) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `pharmacy_orders` ADD `PaymentMethod` varchar(80) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `order_status_history` MODIFY COLUMN `Note` varchar(1000) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `order_status_history` ADD `ActorId` varchar(120) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `order_status_history` ADD `ActorRole` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `notifications` MODIFY COLUMN `CustomerId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `notifications` ADD `StaffUserId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE TABLE `activity_logs` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `ActorId` char(36) COLLATE ascii_general_ci NULL,
        `ActorRole` varchar(40) CHARACTER SET utf8mb4 NULL,
        `Action` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `EntityType` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `EntityId` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `PreviousValue` varchar(4000) CHARACTER SET utf8mb4 NULL,
        `NewValue` varchar(4000) CHARACTER SET utf8mb4 NULL,
        `IpAddress` varchar(80) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_activity_logs` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE TABLE `prescription_status_history` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PrescriptionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Status` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Note` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `ActorId` varchar(120) CHARACTER SET utf8mb4 NULL,
        `ActorRole` varchar(40) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_prescription_status_history` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_prescription_status_history_prescriptions_PrescriptionId` FOREIGN KEY (`PrescriptionId`) REFERENCES `prescriptions` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE TABLE `staff_users` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `FullName` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Email` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Phone` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `PasswordHash` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `Role` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `LicenseReference` varchar(120) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_staff_users` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_staff_users_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE TABLE `stock_transactions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `InventoryId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Type` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Quantity` int NOT NULL,
        `QuantityBefore` int NOT NULL,
        `QuantityAfter` int NOT NULL,
        `Note` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `ActorId` char(36) COLLATE ascii_general_ci NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_stock_transactions` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_stock_transactions_inventory_InventoryId` FOREIGN KEY (`InventoryId`) REFERENCES `inventory` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE TABLE `delivery_assignments` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `DeliveryStaffId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Status` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `AcceptedAt` datetime(6) NULL,
        `PickedUpAt` datetime(6) NULL,
        `OutForDeliveryAt` datetime(6) NULL,
        `DeliveredAt` datetime(6) NULL,
        `FailedAt` datetime(6) NULL,
        `FailureReason` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_delivery_assignments` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_delivery_assignments_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_delivery_assignments_staff_users_DeliveryStaffId` FOREIGN KEY (`DeliveryStaffId`) REFERENCES `staff_users` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_notifications_StaffUserId_CreatedAt` ON `notifications` (`StaffUserId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_activity_logs_EntityType_EntityId_CreatedAt` ON `activity_logs` (`EntityType`, `EntityId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_delivery_assignments_DeliveryStaffId_Status` ON `delivery_assignments` (`DeliveryStaffId`, `Status`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE UNIQUE INDEX `IX_delivery_assignments_OrderId` ON `delivery_assignments` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_prescription_status_history_PrescriptionId_CreatedAt` ON `prescription_status_history` (`PrescriptionId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_staff_users_BranchId` ON `staff_users` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE UNIQUE INDEX `IX_staff_users_Email` ON `staff_users` (`Email`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_staff_users_Role` ON `staff_users` (`Role`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    CREATE INDEX `IX_stock_transactions_InventoryId_CreatedAt` ON `stock_transactions` (`InventoryId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    ALTER TABLE `notifications` ADD CONSTRAINT `FK_notifications_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909211312_PharmacyPhaseTwo') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260909211312_PharmacyPhaseTwo', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    ALTER TABLE `inventory` ADD `BatchNumber` varchar(80) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    ALTER TABLE `inventory` ADD `ExpiryDate` datetime(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    ALTER TABLE `inventory` ADD `MinimumStock` int NOT NULL DEFAULT 0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    ALTER TABLE `inventory` ADD `PurchasePrice` decimal(12,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    ALTER TABLE `inventory` ADD `Supplier` varchar(200) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    CREATE INDEX `IX_inventory_BatchNumber` ON `inventory` (`BatchNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    CREATE INDEX `IX_inventory_ExpiryDate` ON `inventory` (`ExpiryDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909213218_PharmacyPhaseTwoInventory') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260909213218_PharmacyPhaseTwoInventory', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `staff_users` ADD `PermissionsCsv` varchar(4000) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `Barcode` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `DiscountPercent` decimal(6,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `IsBestSeller` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `IsNewArrival` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `PackSize` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `SearchKeywords` varchar(1000) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `products` ADD `TaxRate` decimal(6,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `ClosingTime` time(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Code` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `DeliveryEnabled` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `District` varchar(120) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Email` varchar(240) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Landmark` varchar(240) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Latitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Longitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Municipality` varchar(160) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `OpeningTime` time(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Phone` varchar(30) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `PickupEnabled` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Province` varchar(120) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `StreetTole` varchar(240) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    ALTER TABLE `branches` ADD `Ward` varchar(30) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `cms_pages` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Slug` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Content` longtext CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `SeoTitle` varchar(240) CHARACTER SET utf8mb4 NULL,
        `MetaDescription` varchar(500) CHARACTER SET utf8mb4 NULL,
        `PublishedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_cms_pages` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `coupons` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Code` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Type` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Value` decimal(12,2) NOT NULL,
        `MinimumOrder` decimal(12,2) NULL,
        `MaximumDiscount` decimal(12,2) NULL,
        `UsageLimit` int NULL,
        `UsedCount` int NOT NULL,
        `StartsAt` datetime(6) NULL,
        `EndsAt` datetime(6) NULL,
        `FirstOrderOnly` tinyint(1) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_coupons` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `delivery_zones` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Province` varchar(120) CHARACTER SET utf8mb4 NULL,
        `District` varchar(120) CHARACTER SET utf8mb4 NULL,
        `Municipality` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Ward` varchar(30) CHARACTER SET utf8mb4 NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `DeliveryFee` decimal(12,2) NOT NULL,
        `FreeDeliveryThreshold` decimal(12,2) NOT NULL,
        `MinimumOrder` decimal(12,2) NOT NULL,
        `SameDayDelivery` tinyint(1) NOT NULL,
        `Enabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_delivery_zones` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_delivery_zones_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `faqs` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Question` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `Answer` longtext CHARACTER SET utf8mb4 NOT NULL,
        `Category` varchar(120) CHARACTER SET utf8mb4 NULL,
        `DisplayOrder` int NOT NULL,
        `Published` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_faqs` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `homepage_sections` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SectionKey` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `ContentJson` longtext CHARACTER SET utf8mb4 NULL,
        `DisplayOrder` int NOT NULL,
        `Enabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_homepage_sections` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `suppliers` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `ContactPerson` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Phone` varchar(30) CHARACTER SET utf8mb4 NULL,
        `Email` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Address` varchar(500) CHARACTER SET utf8mb4 NULL,
        `TaxNumber` varchar(80) CHARACTER SET utf8mb4 NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_suppliers` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `system_settings` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Key` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Value` longtext CHARACTER SET utf8mb4 NOT NULL,
        `Group` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `IsPublic` tinyint(1) NOT NULL,
        `Description` varchar(500) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_system_settings` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE TABLE `website_assets` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Kind` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Subtitle` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Description` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `ImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `MobileImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `ButtonText` varchar(100) CHARACTER SET utf8mb4 NULL,
        `Destination` varchar(500) CHARACTER SET utf8mb4 NULL,
        `StartsAt` datetime(6) NULL,
        `EndsAt` datetime(6) NULL,
        `Priority` int NOT NULL,
        `Enabled` tinyint(1) NOT NULL,
        `MobileEnabled` tinyint(1) NOT NULL,
        `DesktopEnabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_website_assets` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_products_Barcode` ON `products` (`Barcode`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE UNIQUE INDEX `IX_branches_Code` ON `branches` (`Code`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE UNIQUE INDEX `IX_cms_pages_Slug` ON `cms_pages` (`Slug`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE UNIQUE INDEX `IX_coupons_Code` ON `coupons` (`Code`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_delivery_zones_BranchId` ON `delivery_zones` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_delivery_zones_District_Municipality_Ward_Enabled` ON `delivery_zones` (`District`, `Municipality`, `Ward`, `Enabled`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_faqs_Published_DisplayOrder` ON `faqs` (`Published`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_homepage_sections_DisplayOrder_Enabled` ON `homepage_sections` (`DisplayOrder`, `Enabled`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_suppliers_Name` ON `suppliers` (`Name`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE UNIQUE INDEX `IX_system_settings_Key` ON `system_settings` (`Key`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    CREATE INDEX `IX_website_assets_Kind_Enabled_Priority` ON `website_assets` (`Kind`, `Enabled`, `Priority`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260909220043_PhaseThreeManagement') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260909220043_PhaseThreeManagement', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260910180132_CouponDiscountsToOrders') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260910180132_CouponDiscountsToOrders', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911004056_CouponDiscountsToOrdersColumns') THEN

    ALTER TABLE `pharmacy_orders` ADD `CouponCode` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911004056_CouponDiscountsToOrdersColumns') THEN

    ALTER TABLE `pharmacy_orders` ADD `DiscountAmount` decimal(12,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911004056_CouponDiscountsToOrdersColumns') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911004056_CouponDiscountsToOrdersColumns', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE TABLE `access_permissions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Key` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Group` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `IsSystem` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_access_permissions` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE TABLE `access_roles` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `DisplayName` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(500) CHARACTER SET utf8mb4 NULL,
        `IsActive` tinyint(1) NOT NULL,
        `IsSystem` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_access_roles` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE TABLE `access_role_permissions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `RoleId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PermissionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_access_role_permissions` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_access_role_permissions_access_permissions_PermissionId` FOREIGN KEY (`PermissionId`) REFERENCES `access_permissions` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_access_role_permissions_access_roles_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `access_roles` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE UNIQUE INDEX `IX_access_permissions_Key` ON `access_permissions` (`Key`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE INDEX `IX_access_role_permissions_PermissionId` ON `access_role_permissions` (`PermissionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE UNIQUE INDEX `IX_access_role_permissions_RoleId_PermissionId` ON `access_role_permissions` (`RoleId`, `PermissionId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    CREATE UNIQUE INDEX `IX_access_roles_Name` ON `access_roles` (`Name`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911021631_AccessControlRolesAndPermissions') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911021631_AccessControlRolesAndPermissions', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911023544_PaymentMethodConfiguration') THEN

    CREATE TABLE `payment_method_configurations` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Code` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `DisplayName` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Instructions` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `MinimumOrder` decimal(18,2) NULL,
        `MaximumOrder` decimal(18,2) NULL,
        `DisplayOrder` int NOT NULL,
        `IsEnabled` tinyint(1) NOT NULL,
        `RequiresServerVerification` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_payment_method_configurations` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911023544_PaymentMethodConfiguration') THEN

    CREATE UNIQUE INDEX `IX_payment_method_configurations_Code` ON `payment_method_configurations` (`Code`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911023544_PaymentMethodConfiguration') THEN

    CREATE INDEX `IX_payment_method_configurations_IsEnabled_DisplayOrder` ON `payment_method_configurations` (`IsEnabled`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911023544_PaymentMethodConfiguration') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911023544_PaymentMethodConfiguration', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911025328_PaymentTransactions') THEN

    CREATE TABLE `payment_transactions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `TransactionNumber` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Method` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(12,2) NOT NULL,
        `ProviderReference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `PaidAt` datetime(6) NULL,
        `RefundedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_payment_transactions` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_payment_transactions_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911025328_PaymentTransactions') THEN

    CREATE INDEX `IX_payment_transactions_OrderId_CreatedAt` ON `payment_transactions` (`OrderId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911025328_PaymentTransactions') THEN

    CREATE UNIQUE INDEX `IX_payment_transactions_TransactionNumber` ON `payment_transactions` (`TransactionNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911025328_PaymentTransactions') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911025328_PaymentTransactions', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911032112_ProductReviews') THEN

    CREATE TABLE `product_reviews` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NULL,
        `Rating` int NOT NULL,
        `Comment` varchar(2000) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `AdminResponse` varchar(2000) CHARACTER SET utf8mb4 NULL,
        `PublishedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_product_reviews` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_product_reviews_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_product_reviews_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_product_reviews_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911032112_ProductReviews') THEN

    CREATE INDEX `IX_product_reviews_CustomerId` ON `product_reviews` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911032112_ProductReviews') THEN

    CREATE INDEX `IX_product_reviews_OrderId` ON `product_reviews` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911032112_ProductReviews') THEN

    CREATE INDEX `IX_product_reviews_ProductId_Status_CreatedAt` ON `product_reviews` (`ProductId`, `Status`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911032112_ProductReviews') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911032112_ProductReviews', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    CREATE TABLE `support_tickets` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `AssignedStaffId` char(36) COLLATE ascii_general_ci NULL,
        `TicketNumber` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Subject` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(4000) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Priority` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `Category` varchar(80) CHARACTER SET utf8mb4 NULL,
        `Resolution` varchar(4000) CHARACTER SET utf8mb4 NULL,
        `ResolvedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_support_tickets` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_support_tickets_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_support_tickets_staff_users_AssignedStaffId` FOREIGN KEY (`AssignedStaffId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    CREATE INDEX `IX_support_tickets_AssignedStaffId` ON `support_tickets` (`AssignedStaffId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    CREATE INDEX `IX_support_tickets_CustomerId` ON `support_tickets` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    CREATE INDEX `IX_support_tickets_Status_Priority_CreatedAt` ON `support_tickets` (`Status`, `Priority`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    CREATE UNIQUE INDEX `IX_support_tickets_TicketNumber` ON `support_tickets` (`TicketNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911033353_SupportTickets') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911033353_SupportTickets', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911035417_NotificationTemplates') THEN

    CREATE TABLE `notification_templates` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Code` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Name` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Channel` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Subject` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Body` varchar(4000) CHARACTER SET utf8mb4 NOT NULL,
        `Variables` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `IsEnabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_notification_templates` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911035417_NotificationTemplates') THEN

    CREATE INDEX `IX_notification_templates_Channel_IsEnabled` ON `notification_templates` (`Channel`, `IsEnabled`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911035417_NotificationTemplates') THEN

    CREATE UNIQUE INDEX `IX_notification_templates_Code` ON `notification_templates` (`Code`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911035417_NotificationTemplates') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911035417_NotificationTemplates', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911040638_HealthArticles') THEN

    CREATE TABLE `health_articles` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Slug` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(240) CHARACTER SET utf8mb4 NOT NULL,
        `Excerpt` varchar(500) CHARACTER SET utf8mb4 NULL,
        `Content` longtext CHARACTER SET utf8mb4 NOT NULL,
        `Category` varchar(120) CHARACTER SET utf8mb4 NULL,
        `TagsCsv` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `AuthorName` varchar(160) CHARACTER SET utf8mb4 NULL,
        `FeaturedImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `SeoTitle` varchar(240) CHARACTER SET utf8mb4 NULL,
        `MetaDescription` varchar(500) CHARACTER SET utf8mb4 NULL,
        `PublishedAt` datetime(6) NULL,
        `ScheduledAt` datetime(6) NULL,
        `IsFeatured` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_health_articles` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911040638_HealthArticles') THEN

    CREATE UNIQUE INDEX `IX_health_articles_Slug` ON `health_articles` (`Slug`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911040638_HealthArticles') THEN

    CREATE INDEX `IX_health_articles_Status_PublishedAt_ScheduledAt` ON `health_articles` (`Status`, `PublishedAt`, `ScheduledAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911040638_HealthArticles') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911040638_HealthArticles', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911042143_FlashSales') THEN

    CREATE TABLE `flash_sales` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(180) CHARACTER SET utf8mb4 NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `DiscountPercent` decimal(6,2) NOT NULL,
        `QuantityLimit` int NULL,
        `QuantitySold` int NOT NULL,
        `StartsAt` datetime(6) NOT NULL,
        `EndsAt` datetime(6) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_flash_sales` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_flash_sales_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_flash_sales_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911042143_FlashSales') THEN

    CREATE INDEX `IX_flash_sales_BranchId` ON `flash_sales` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911042143_FlashSales') THEN

    CREATE INDEX `IX_flash_sales_IsActive_StartsAt_EndsAt` ON `flash_sales` (`IsActive`, `StartsAt`, `EndsAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911042143_FlashSales') THEN

    CREATE INDEX `IX_flash_sales_ProductId_IsActive_StartsAt_EndsAt` ON `flash_sales` (`ProductId`, `IsActive`, `StartsAt`, `EndsAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911042143_FlashSales') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911042143_FlashSales', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE TABLE `purchase_orders` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderNumber` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `SupplierId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `ExpectedAt` datetime(6) NULL,
        `Notes` varchar(2000) CHARACTER SET utf8mb4 NULL,
        `TotalAmount` decimal(14,2) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_purchase_orders` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_purchase_orders_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_purchase_orders_suppliers_SupplierId` FOREIGN KEY (`SupplierId`) REFERENCES `suppliers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE TABLE `purchase_order_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PurchaseOrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductName` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `QuantityOrdered` int NOT NULL,
        `QuantityReceived` int NOT NULL,
        `UnitCost` decimal(14,2) NOT NULL,
        `BatchNumber` varchar(100) CHARACTER SET utf8mb4 NULL,
        `ExpiryDate` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_purchase_order_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_purchase_order_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_purchase_order_items_purchase_orders_PurchaseOrderId` FOREIGN KEY (`PurchaseOrderId`) REFERENCES `purchase_orders` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE INDEX `IX_purchase_order_items_ProductId` ON `purchase_order_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE INDEX `IX_purchase_order_items_PurchaseOrderId_ProductId` ON `purchase_order_items` (`PurchaseOrderId`, `ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE INDEX `IX_purchase_orders_BranchId` ON `purchase_orders` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE UNIQUE INDEX `IX_purchase_orders_OrderNumber` ON `purchase_orders` (`OrderNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE INDEX `IX_purchase_orders_Status_CreatedAt` ON `purchase_orders` (`Status`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    CREATE INDEX `IX_purchase_orders_SupplierId` ON `purchase_orders` (`SupplierId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911044008_PurchaseOrders') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911044008_PurchaseOrders', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911161237_OrderBranchTracking') THEN

    ALTER TABLE `pharmacy_orders` ADD `BranchId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911161237_OrderBranchTracking') THEN

    CREATE INDEX `IX_pharmacy_orders_BranchId` ON `pharmacy_orders` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911161237_OrderBranchTracking') THEN

    ALTER TABLE `pharmacy_orders` ADD CONSTRAINT `FK_pharmacy_orders_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911161237_OrderBranchTracking') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911161237_OrderBranchTracking', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE TABLE `media_assets` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OriginalFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
        `StoredFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
        `ContentType` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Length` bigint NOT NULL,
        `Sha256` varchar(64) CHARACTER SET utf8mb4 NOT NULL,
        `Kind` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `AltText` varchar(240) CHARACTER SET utf8mb4 NULL,
        `IsPublic` tinyint(1) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_media_assets` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE TABLE `navigation_menu_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `MenuKey` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Label` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Url` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `ParentId` char(36) COLLATE ascii_general_ci NULL,
        `Icon` varchar(80) CHARACTER SET utf8mb4 NULL,
        `DisplayOrder` int NOT NULL,
        `IsVisible` tinyint(1) NOT NULL,
        `OpenInNewTab` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_navigation_menu_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_navigation_menu_items_navigation_menu_items_ParentId` FOREIGN KEY (`ParentId`) REFERENCES `navigation_menu_items` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE TABLE `popup_campaigns` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Kind` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(220) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(1600) CHARACTER SET utf8mb4 NULL,
        `ImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `ButtonText` varchar(120) CHARACTER SET utf8mb4 NULL,
        `Destination` varchar(500) CHARACTER SET utf8mb4 NULL,
        `DelaySeconds` int NOT NULL,
        `Frequency` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Audience` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `MobileEnabled` tinyint(1) NOT NULL,
        `DesktopEnabled` tinyint(1) NOT NULL,
        `StartsAt` datetime(6) NULL,
        `EndsAt` datetime(6) NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_popup_campaigns` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE TABLE `seo_entries` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Scope` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Path` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(240) CHARACTER SET utf8mb4 NULL,
        `MetaDescription` varchar(500) CHARACTER SET utf8mb4 NULL,
        `Keywords` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `OgTitle` varchar(240) CHARACTER SET utf8mb4 NULL,
        `OgDescription` varchar(500) CHARACTER SET utf8mb4 NULL,
        `OgImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `CanonicalUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `Robots` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_seo_entries` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE INDEX `IX_media_assets_Kind_IsPublic_IsActive` ON `media_assets` (`Kind`, `IsPublic`, `IsActive`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE INDEX `IX_media_assets_Sha256` ON `media_assets` (`Sha256`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE INDEX `IX_navigation_menu_items_MenuKey_DisplayOrder_IsVisible` ON `navigation_menu_items` (`MenuKey`, `DisplayOrder`, `IsVisible`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE INDEX `IX_navigation_menu_items_ParentId` ON `navigation_menu_items` (`ParentId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE INDEX `IX_popup_campaigns_IsActive_StartsAt_EndsAt` ON `popup_campaigns` (`IsActive`, `StartsAt`, `EndsAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    CREATE UNIQUE INDEX `IX_seo_entries_Scope_Path` ON `seo_entries` (`Scope`, `Path`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911163409_WebsiteControlContent') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911163409_WebsiteControlContent', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    ALTER TABLE `pharmacy_orders` ADD `PharmacistId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    CREATE TABLE `invoices` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NOT NULL,
        `InvoiceNumber` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Subtotal` decimal(12,2) NOT NULL,
        `TaxAmount` decimal(12,2) NOT NULL,
        `DiscountAmount` decimal(12,2) NOT NULL,
        `DeliveryFee` decimal(12,2) NOT NULL,
        `Total` decimal(12,2) NOT NULL,
        `IssuedAt` datetime(6) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_invoices` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_invoices_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    CREATE INDEX `IX_pharmacy_orders_PharmacistId` ON `pharmacy_orders` (`PharmacistId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    CREATE UNIQUE INDEX `IX_invoices_InvoiceNumber` ON `invoices` (`InvoiceNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    CREATE UNIQUE INDEX `IX_invoices_OrderId` ON `invoices` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    ALTER TABLE `pharmacy_orders` ADD CONSTRAINT `FK_pharmacy_orders_staff_users_PharmacistId` FOREIGN KEY (`PharmacistId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911170314_OrderAssignmentsAndInvoices') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911170314_OrderAssignmentsAndInvoices', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    ALTER TABLE `pharmacy_orders` ADD `DeliverySlotId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    CREATE TABLE `delivery_slots` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Label` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `StartTime` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
        `EndTime` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `MaxOrders` int NULL,
        `DisplayOrder` int NOT NULL,
        `Enabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_delivery_slots` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_delivery_slots_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    CREATE INDEX `IX_pharmacy_orders_DeliverySlotId` ON `pharmacy_orders` (`DeliverySlotId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    CREATE INDEX `IX_delivery_slots_BranchId_DisplayOrder_Enabled` ON `delivery_slots` (`BranchId`, `DisplayOrder`, `Enabled`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    ALTER TABLE `pharmacy_orders` ADD CONSTRAINT `FK_pharmacy_orders_delivery_slots_DeliverySlotId` FOREIGN KEY (`DeliverySlotId`) REFERENCES `delivery_slots` (`Id`) ON DELETE SET NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260911173051_DeliveryTimeSlots') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260911173051_DeliveryTimeSlots', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912011441_SystemBackups') THEN

    CREATE TABLE `system_backups` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `FileName` varchar(180) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Provider` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `SizeBytes` bigint NOT NULL,
        `Sha256` varchar(64) CHARACTER SET utf8mb4 NULL,
        `FailureReason` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedBy` varchar(120) CHARACTER SET utf8mb4 NULL,
        `CompletedAt` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_system_backups` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912011441_SystemBackups') THEN

    CREATE UNIQUE INDEX `IX_system_backups_FileName` ON `system_backups` (`FileName`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912011441_SystemBackups') THEN

    CREATE INDEX `IX_system_backups_Status_CreatedAt` ON `system_backups` (`Status`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912011441_SystemBackups') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260912011441_SystemBackups', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    ALTER TABLE `staff_users` ADD `Address` varchar(500) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    ALTER TABLE `staff_users` ADD `EmployeeId` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    ALTER TABLE `staff_users` ADD `JoiningDate` datetime(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    ALTER TABLE `staff_users` ADD `ProfilePhotoContentType` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    ALTER TABLE `staff_users` ADD `ProfilePhotoStoredFileName` varchar(120) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    CREATE UNIQUE INDEX `IX_staff_users_EmployeeId` ON `staff_users` (`EmployeeId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912014600_StaffProfileDetails') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260912014600_StaffProfileDetails', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912015614_SupportTicketMessages') THEN

    CREATE TABLE `support_ticket_messages` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SupportTicketId` char(36) COLLATE ascii_general_ci NOT NULL,
        `StaffUserId` char(36) COLLATE ascii_general_ci NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NULL,
        `Message` varchar(4000) CHARACTER SET utf8mb4 NOT NULL,
        `IsInternal` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_support_ticket_messages` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_support_ticket_messages_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_support_ticket_messages_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_support_ticket_messages_support_tickets_SupportTicketId` FOREIGN KEY (`SupportTicketId`) REFERENCES `support_tickets` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912015614_SupportTicketMessages') THEN

    CREATE INDEX `IX_support_ticket_messages_CustomerId` ON `support_ticket_messages` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912015614_SupportTicketMessages') THEN

    CREATE INDEX `IX_support_ticket_messages_StaffUserId` ON `support_ticket_messages` (`StaffUserId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912015614_SupportTicketMessages') THEN

    CREATE INDEX `IX_support_ticket_messages_SupportTicketId_CreatedAt` ON `support_ticket_messages` (`SupportTicketId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912015614_SupportTicketMessages') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260912015614_SupportTicketMessages', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `SecondaryButtonText` varchar(100) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `SecondaryButtonUrl` varchar(500) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `OverlayOpacity` int NOT NULL DEFAULT 35;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `TextAlignment` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'LEFT';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `ContentPosition` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'CENTER';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `BackgroundPosition` varchar(40) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'CENTER';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `CustomLabel` varchar(100) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `AnimationType` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'FADE_ZOOM';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `SlideDuration` int NOT NULL DEFAULT 5000;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `TransitionDuration` int NOT NULL DEFAULT 700;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `AutoplayEnabled` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `PauseOnHover` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `ShowNavigationArrows` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `ShowPaginationDots` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `LoopSlides` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `RandomizeSlides` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    ALTER TABLE `website_assets` ADD `RespectSchedule` tinyint(1) NOT NULL DEFAULT TRUE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260912123000_HeroSlideFields') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260912123000_HeroSlideFields', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913162206_HrmsAttendanceLeavePayroll') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260913162206_HrmsAttendanceLeavePayroll', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE TABLE `attendance_records` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `StaffUserId` char(36) COLLATE ascii_general_ci NOT NULL,
        `WorkDate` date NOT NULL,
        `CheckInUtc` datetime(6) NULL,
        `CheckOutUtc` datetime(6) NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `TotalMinutes` int NOT NULL,
        `OvertimeMinutes` int NOT NULL,
        `IsFinalized` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_attendance_records` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_attendance_records_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE TABLE `leave_requests` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `StaffUserId` char(36) COLLATE ascii_general_ci NOT NULL,
        `LeaveType` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `StartDate` date NOT NULL,
        `EndDate` date NOT NULL,
        `Reason` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `ApprovalComment` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `ApprovedByStaffUserId` char(36) COLLATE ascii_general_ci NULL,
        `DecidedAtUtc` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_leave_requests` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_leave_requests_staff_users_ApprovedByStaffUserId` FOREIGN KEY (`ApprovedByStaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_leave_requests_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE TABLE `payroll_records` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `StaffUserId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PayrollMonth` date NOT NULL,
        `BasicSalary` decimal(14,2) NOT NULL,
        `Allowances` decimal(14,2) NOT NULL,
        `OvertimeAmount` decimal(14,2) NOT NULL,
        `Bonus` decimal(14,2) NOT NULL,
        `Deductions` decimal(14,2) NOT NULL,
        `GrossSalary` decimal(14,2) NOT NULL,
        `NetSalary` decimal(14,2) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `PaidAtUtc` datetime(6) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_payroll_records` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_payroll_records_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE UNIQUE INDEX `IX_attendance_records_StaffUserId_WorkDate` ON `attendance_records` (`StaffUserId`, `WorkDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE INDEX `IX_leave_requests_ApprovedByStaffUserId` ON `leave_requests` (`ApprovedByStaffUserId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE INDEX `IX_leave_requests_StaffUserId_StartDate_EndDate` ON `leave_requests` (`StaffUserId`, `StartDate`, `EndDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    CREATE UNIQUE INDEX `IX_payroll_records_StaffUserId_PayrollMonth` ON `payroll_records` (`StaffUserId`, `PayrollMonth`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913170131_HrmsAttendanceLeavePayrollSchema') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260913170131_HrmsAttendanceLeavePayrollSchema', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175526_AccountantFinanceModule') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260913175526_AccountantFinanceModule', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `invoices` ADD `DueAt` datetime(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `invoices` ADD `IsWholesale` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `invoices` ADD `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `invoices` ADD `PaidAmount` decimal(12,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `invoices` ADD `PaymentStatus` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `customers` ADD `CreditLimit` decimal(14,2) NOT NULL DEFAULT 0.0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `customers` ADD `CustomerType` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `customers` ADD `PaymentTermsDays` int NOT NULL DEFAULT 0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    ALTER TABLE `customers` ADD `TaxNumber` varchar(80) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `bank_reconciliations` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `StatementDate` datetime(6) NOT NULL,
        `BankAccount` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `TransactionType` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `MatchedSource` varchar(80) CHARACTER SET utf8mb4 NULL,
        `MatchedId` char(36) COLLATE ascii_general_ci NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_bank_reconciliations` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `business_expenses` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Category` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(300) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `ExpenseDate` datetime(6) NOT NULL,
        `PaymentMethod` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_business_expenses` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `supplier_invoices` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SupplierId` char(36) COLLATE ascii_general_ci NOT NULL,
        `InvoiceNumber` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `InvoiceDate` datetime(6) NOT NULL,
        `DueAt` datetime(6) NULL,
        `Subtotal` decimal(14,2) NOT NULL,
        `TaxAmount` decimal(14,2) NOT NULL,
        `Total` decimal(14,2) NOT NULL,
        `PaidAmount` decimal(14,2) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_supplier_invoices` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_supplier_invoices_suppliers_SupplierId` FOREIGN KEY (`SupplierId`) REFERENCES `suppliers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `tax_configurations` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `VatRate` decimal(6,2) NOT NULL,
        `EffectiveFrom` datetime(6) NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_tax_configurations` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `accountant_payments` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `InvoiceId` char(36) COLLATE ascii_general_ci NULL,
        `SupplierInvoiceId` char(36) COLLATE ascii_general_ci NULL,
        `PaymentNumber` varchar(60) CHARACTER SET utf8mb4 NOT NULL,
        `Method` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `PaymentDate` datetime(6) NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_accountant_payments` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_accountant_payments_invoices_InvoiceId` FOREIGN KEY (`InvoiceId`) REFERENCES `invoices` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_accountant_payments_supplier_invoices_SupplierInvoiceId` FOREIGN KEY (`SupplierInvoiceId`) REFERENCES `supplier_invoices` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE TABLE `customer_ledger_entries` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `InvoiceId` char(36) COLLATE ascii_general_ci NULL,
        `PaymentId` char(36) COLLATE ascii_general_ci NULL,
        `EntryType` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `EntryDate` datetime(6) NOT NULL,
        `DueAt` datetime(6) NULL,
        `Description` varchar(300) CHARACTER SET utf8mb4 NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_customer_ledger_entries` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_customer_ledger_entries_accountant_payments_PaymentId` FOREIGN KEY (`PaymentId`) REFERENCES `accountant_payments` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_customer_ledger_entries_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE,
        CONSTRAINT `FK_customer_ledger_entries_invoices_InvoiceId` FOREIGN KEY (`InvoiceId`) REFERENCES `invoices` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_accountant_payments_InvoiceId` ON `accountant_payments` (`InvoiceId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE UNIQUE INDEX `IX_accountant_payments_PaymentNumber` ON `accountant_payments` (`PaymentNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_accountant_payments_SupplierInvoiceId` ON `accountant_payments` (`SupplierInvoiceId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_bank_reconciliations_StatementDate_Status` ON `bank_reconciliations` (`StatementDate`, `Status`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_business_expenses_ExpenseDate` ON `business_expenses` (`ExpenseDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_customer_ledger_entries_CustomerId_EntryDate` ON `customer_ledger_entries` (`CustomerId`, `EntryDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_customer_ledger_entries_InvoiceId` ON `customer_ledger_entries` (`InvoiceId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_customer_ledger_entries_PaymentId` ON `customer_ledger_entries` (`PaymentId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE UNIQUE INDEX `IX_supplier_invoices_SupplierId_InvoiceNumber` ON `supplier_invoices` (`SupplierId`, `InvoiceNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    CREATE INDEX `IX_tax_configurations_IsActive_EffectiveFrom` ON `tax_configurations` (`IsActive`, `EffectiveFrom`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260913175625_AccountantFinanceModelFix') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260913175625_AccountantFinanceModelFix', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914013930_AccountantJournalModule') THEN

    CREATE TABLE `journal_entries` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `EntryDate` datetime(6) NOT NULL,
        `Reference` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(300) CHARACTER SET utf8mb4 NOT NULL,
        `DebitAccount` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `CreditAccount` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_journal_entries` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914013930_AccountantJournalModule') THEN

    CREATE INDEX `IX_journal_entries_EntryDate_Status` ON `journal_entries` (`EntryDate`, `Status`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914013930_AccountantJournalModule') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260914013930_AccountantJournalModule', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `staff_users` ADD `ShiftId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `branches` ADD `AttendanceRadiusMeters` int NOT NULL DEFAULT 0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `branches` ADD `LocationRequired` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInAccuracy` decimal(10,2) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInLatitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInLocationSource` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInLocationStatus` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInLocationTimestampUtc` datetime(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckInLongitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutAccuracy` decimal(10,2) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutLatitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutLocationSource` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutLocationStatus` varchar(40) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutLocationTimestampUtc` datetime(6) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `CheckOutLongitude` decimal(10,7) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `LateMinutes` int NOT NULL DEFAULT 0;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD `ShiftId` char(36) COLLATE ascii_general_ci NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE TABLE `attendance_corrections` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `StaffUserId` char(36) COLLATE ascii_general_ci NOT NULL,
        `WorkDate` date NOT NULL,
        `RequestedCheckInUtc` datetime(6) NULL,
        `RequestedCheckOutUtc` datetime(6) NULL,
        `Reason` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `ReviewedByStaffUserId` char(36) COLLATE ascii_general_ci NULL,
        `ReviewedAtUtc` datetime(6) NULL,
        `ReviewComment` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_attendance_corrections` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_attendance_corrections_staff_users_ReviewedByStaffUserId` FOREIGN KEY (`ReviewedByStaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_attendance_corrections_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE TABLE `attendance_settings` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `LateCheckInGraceMinutes` int NOT NULL,
        `EarlyCheckInGraceMinutes` int NOT NULL,
        `EarlyCheckOutGraceMinutes` int NOT NULL,
        `LateCheckOutGraceMinutes` int NOT NULL,
        `DefaultRadiusMeters` int NOT NULL,
        `LocationRequired` tinyint(1) NOT NULL,
        `BusinessTimeZone` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `UpdatedByStaffUserId` char(36) COLLATE ascii_general_ci NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_attendance_settings` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE TABLE `work_shifts` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Name` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `ShiftType` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `StartTime` time(6) NOT NULL,
        `EndTime` time(6) NOT NULL,
        `BreakDurationMinutes` int NOT NULL,
        `GracePeriodMinutes` int NOT NULL,
        `MinimumWorkingMinutes` int NOT NULL,
        `LateThresholdMinutes` int NOT NULL,
        `HalfDayThresholdMinutes` int NOT NULL,
        `OvertimeThresholdMinutes` int NOT NULL,
        `WeeklyOffDays` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
        `IsActive` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_work_shifts` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE INDEX `IX_staff_users_ShiftId` ON `staff_users` (`ShiftId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE INDEX `IX_attendance_records_ShiftId` ON `attendance_records` (`ShiftId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE INDEX `IX_attendance_corrections_ReviewedByStaffUserId` ON `attendance_corrections` (`ReviewedByStaffUserId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE INDEX `IX_attendance_corrections_StaffUserId_WorkDate_Status` ON `attendance_corrections` (`StaffUserId`, `WorkDate`, `Status`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE UNIQUE INDEX `IX_attendance_settings_Id` ON `attendance_settings` (`Id`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    CREATE UNIQUE INDEX `IX_work_shifts_Name` ON `work_shifts` (`Name`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `attendance_records` ADD CONSTRAINT `FK_attendance_records_work_shifts_ShiftId` FOREIGN KEY (`ShiftId`) REFERENCES `work_shifts` (`Id`) ON DELETE SET NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    ALTER TABLE `staff_users` ADD CONSTRAINT `FK_staff_users_work_shifts_ShiftId` FOREIGN KEY (`ShiftId`) REFERENCES `work_shifts` (`Id`) ON DELETE SET NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914020500_HrmsLocationShiftsAndCorrections') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260914020500_HrmsLocationShiftsAndCorrections', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    ALTER TABLE `products` ADD `BonusScheme` varchar(120) CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    ALTER TABLE `customers` ADD `account_type` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    CREATE TABLE `pharmacy_details` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `PanNumber` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `PanRegisteredName` varchar(240) CHARACTER SET utf8mb4 NULL,
        `PharmacyName` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Province` varchar(120) CHARACTER SET utf8mb4 NULL,
        `District` varchar(120) CHARACTER SET utf8mb4 NULL,
        `Municipality` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Ward` varchar(30) CHARACTER SET utf8mb4 NULL,
        `Address` varchar(500) CHARACTER SET utf8mb4 NULL,
        `DrugLicenseNumber` varchar(120) CHARACTER SET utf8mb4 NULL,
        `OwnerPhone` varchar(30) CHARACTER SET utf8mb4 NULL,
        `OwnerEmail` varchar(240) CHARACTER SET utf8mb4 NULL,
        `Category` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `PanVerificationStatus` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `PanVerifiedAtUtc` datetime(6) NULL,
        `PanVerificationSource` varchar(80) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_pharmacy_details` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_pharmacy_details_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    CREATE INDEX `IX_customers_account_type` ON `customers` (`account_type`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    CREATE UNIQUE INDEX `IX_pharmacy_details_CustomerId` ON `pharmacy_details` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    CREATE UNIQUE INDEX `IX_pharmacy_details_PanNumber` ON `pharmacy_details` (`PanNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914094824_CustomerAccountTypesAndPharmacyDetails') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260914094824_CustomerAccountTypesAndPharmacyDetails', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914095148_NormalizeCustomerAccountType') THEN

    UPDATE customers SET account_type = 'PERSONAL' WHERE account_type IS NULL OR account_type = '';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914095148_NormalizeCustomerAccountType') THEN

    ALTER TABLE `customers` MODIFY COLUMN `account_type` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'PERSONAL';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260914095148_NormalizeCustomerAccountType') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260914095148_NormalizeCustomerAccountType', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `customers` ADD `DateOfBirth` date NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `customers` ADD `Gender` varchar(40) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `customers` ADD `Username` varchar(80) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `pharmacy_details` ADD `ContactPersonName` varchar(160) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `pharmacy_details` ADD `Landmark` varchar(240) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `pharmacy_details` ADD `PharmacistRegistrationNumber` varchar(120) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `pharmacy_details` ADD `PreferredBranchId` char(36) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    ALTER TABLE `pharmacy_details` ADD `Telephone` varchar(30) NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    CREATE UNIQUE INDEX `IX_customers_Username` ON `customers` (`Username`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916040703_RegistrationProfileFields') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916040703_RegistrationProfileFields', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916060809_HeroTypewriterVariant') THEN

    ALTER TABLE `website_assets` ADD `BackgroundColor` varchar(7) CHARACTER SET utf8mb4 NOT NULL DEFAULT '#F8F6F1';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916060809_HeroTypewriterVariant') THEN

    ALTER TABLE `website_assets` ADD `LayoutVariant` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'STANDARD';

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916060809_HeroTypewriterVariant') THEN

    ALTER TABLE `website_assets` ADD `TypingSpeedMs` int NOT NULL DEFAULT 52;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916060809_HeroTypewriterVariant') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916060809_HeroTypewriterVariant', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916071019_RoleSidebarMenu') THEN

    CREATE TABLE `role_sidebar_menu_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        `Role` varchar(40) NOT NULL,
        `Label` varchar(120) NOT NULL,
        `Href` varchar(300) NOT NULL,
        `Icon` varchar(50) NOT NULL,
        `DisplayOrder` int NOT NULL,
        `IsVisible` tinyint(1) NOT NULL,
        CONSTRAINT `PK_role_sidebar_menu_items` PRIMARY KEY (`Id`)
    );

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916071019_RoleSidebarMenu') THEN

    CREATE UNIQUE INDEX `IX_role_sidebar_menu_items_Role_DisplayOrder` ON `role_sidebar_menu_items` (`Role`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916071019_RoleSidebarMenu') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916071019_RoleSidebarMenu', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916105558_ActivityLogPayloadCapacity') THEN

    ALTER TABLE `activity_logs` MODIFY COLUMN `PreviousValue` longtext CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916105558_ActivityLogPayloadCapacity') THEN

    ALTER TABLE `activity_logs` MODIFY COLUMN `NewValue` longtext CHARACTER SET utf8mb4 NULL;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916105558_ActivityLogPayloadCapacity') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916105558_ActivityLogPayloadCapacity', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916111400_AddTrendingProducts') THEN

    ALTER TABLE `products` ADD `IsTrending` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916111400_AddTrendingProducts') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916111400_AddTrendingProducts', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916120000_ProductImages') THEN

    CREATE TABLE `product_images` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Url` varchar(500) NOT NULL,
        `DisplayOrder` int NOT NULL,
        `AltText` varchar(240) NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_product_images` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_product_images_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE CASCADE
    );

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916120000_ProductImages') THEN

    CREATE UNIQUE INDEX `IX_product_images_ProductId_DisplayOrder` ON `product_images` (`ProductId`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916120000_ProductImages') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916120000_ProductImages', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916122500_RoleSidebarMenuTableFix') THEN

    CREATE TABLE IF NOT EXISTS `role_sidebar_menu_items` (
        `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        `Role` varchar(40) NOT NULL,
        `Label` varchar(120) NOT NULL,
        `Href` varchar(300) NOT NULL,
        `Icon` varchar(50) NOT NULL,
        `DisplayOrder` int NOT NULL,
        `IsVisible` tinyint(1) NOT NULL,
        CONSTRAINT `PK_role_sidebar_menu_items` PRIMARY KEY (`Id`),
        UNIQUE KEY `IX_role_sidebar_menu_items_Role_DisplayOrder` (`Role`, `DisplayOrder`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260916122500_RoleSidebarMenuTableFix') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260916122500_RoleSidebarMenuTableFix', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    ALTER TABLE `product_images` ADD `BackgroundRemoved` tinyint(1) NOT NULL DEFAULT FALSE;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `contact_widget_links` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `Type` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `Label` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Target` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
        `Icon` varchar(80) CHARACTER SET utf8mb4 NULL,
        `PredefinedMessage` varchar(500) CHARACTER SET utf8mb4 NULL,
        `DisplayOrder` int NOT NULL,
        `IsEnabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_contact_widget_links` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `customer_credit` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `CreditLimit` decimal(14,2) NOT NULL,
        `CurrentBalance` decimal(14,2) NOT NULL,
        `PaymentTermsDays` int NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_customer_credit` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_customer_credit_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `customer_payments` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `PaymentNumber` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `Method` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `PaymentDate` datetime(6) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_customer_payments` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_customer_payments_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_customer_payments_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `purchase_returns` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `ReturnNumber` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `PurchaseOrderId` char(36) COLLATE ascii_general_ci NULL,
        `SupplierId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ReturnDate` datetime(6) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `TotalAmount` decimal(14,2) NOT NULL,
        `Reason` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_purchase_returns` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_purchase_returns_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_purchase_returns_purchase_orders_PurchaseOrderId` FOREIGN KEY (`PurchaseOrderId`) REFERENCES `purchase_orders` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_purchase_returns_suppliers_SupplierId` FOREIGN KEY (`SupplierId`) REFERENCES `suppliers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `sale_returns` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `ReturnNumber` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `OrderId` char(36) COLLATE ascii_general_ci NULL,
        `CustomerId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ReturnDate` datetime(6) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `TotalAmount` decimal(14,2) NOT NULL,
        `Reason` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_sale_returns` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_sale_returns_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_sale_returns_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_sale_returns_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE SET NULL
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `supplier_payments` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SupplierId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BranchId` char(36) COLLATE ascii_general_ci NULL,
        `PaymentNumber` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
        `Amount` decimal(14,2) NOT NULL,
        `Method` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
        `PaymentDate` datetime(6) NOT NULL,
        `Status` varchar(30) CHARACTER SET utf8mb4 NOT NULL,
        `Reference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_supplier_payments` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_supplier_payments_branches_BranchId` FOREIGN KEY (`BranchId`) REFERENCES `branches` (`Id`) ON DELETE SET NULL,
        CONSTRAINT `FK_supplier_payments_suppliers_SupplierId` FOREIGN KEY (`SupplierId`) REFERENCES `suppliers` (`Id`) ON DELETE RESTRICT
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `trust_badges` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `BadgeKey` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
        `Title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
        `Description` varchar(1000) CHARACTER SET utf8mb4 NULL,
        `ImageUrl` varchar(500) CHARACTER SET utf8mb4 NULL,
        `DisplayOrder` int NOT NULL,
        `IsEnabled` tinyint(1) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_trust_badges` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `purchase_return_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `PurchaseReturnId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BatchNumber` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Quantity` int NOT NULL,
        `UnitCost` decimal(14,2) NOT NULL,
        `TotalAmount` decimal(14,2) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_purchase_return_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_purchase_return_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_purchase_return_items_purchase_returns_PurchaseReturnId` FOREIGN KEY (`PurchaseReturnId`) REFERENCES `purchase_returns` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE TABLE `sale_return_items` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SaleReturnId` char(36) COLLATE ascii_general_ci NOT NULL,
        `ProductId` char(36) COLLATE ascii_general_ci NOT NULL,
        `BatchNumber` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `Quantity` int NOT NULL,
        `UnitPrice` decimal(14,2) NOT NULL,
        `TotalAmount` decimal(14,2) NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_sale_return_items` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_sale_return_items_products_ProductId` FOREIGN KEY (`ProductId`) REFERENCES `products` (`Id`) ON DELETE RESTRICT,
        CONSTRAINT `FK_sale_return_items_sale_returns_SaleReturnId` FOREIGN KEY (`SaleReturnId`) REFERENCES `sale_returns` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_products_IsHotDeal` ON `products` (`IsHotDeal`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_contact_widget_links_IsEnabled_DisplayOrder` ON `contact_widget_links` (`IsEnabled`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_customer_credit_CustomerId` ON `customer_credit` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_customer_credit_Status` ON `customer_credit` (`Status`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_customer_payments_BranchId` ON `customer_payments` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_customer_payments_CustomerId_PaymentDate` ON `customer_payments` (`CustomerId`, `PaymentDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_customer_payments_PaymentNumber` ON `customer_payments` (`PaymentNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_purchase_return_items_ProductId` ON `purchase_return_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_purchase_return_items_PurchaseReturnId_ProductId_BatchNumber` ON `purchase_return_items` (`PurchaseReturnId`, `ProductId`, `BatchNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_purchase_returns_BranchId_ReturnDate` ON `purchase_returns` (`BranchId`, `ReturnDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_purchase_returns_PurchaseOrderId` ON `purchase_returns` (`PurchaseOrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_purchase_returns_ReturnNumber` ON `purchase_returns` (`ReturnNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_purchase_returns_SupplierId` ON `purchase_returns` (`SupplierId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_sale_return_items_ProductId` ON `sale_return_items` (`ProductId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_sale_return_items_SaleReturnId_ProductId_BatchNumber` ON `sale_return_items` (`SaleReturnId`, `ProductId`, `BatchNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_sale_returns_BranchId_ReturnDate` ON `sale_returns` (`BranchId`, `ReturnDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_sale_returns_CustomerId` ON `sale_returns` (`CustomerId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_sale_returns_OrderId` ON `sale_returns` (`OrderId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_sale_returns_ReturnNumber` ON `sale_returns` (`ReturnNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_supplier_payments_BranchId` ON `supplier_payments` (`BranchId`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_supplier_payments_PaymentNumber` ON `supplier_payments` (`PaymentNumber`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_supplier_payments_SupplierId_PaymentDate` ON `supplier_payments` (`SupplierId`, `PaymentDate`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE UNIQUE INDEX `IX_trust_badges_BadgeKey` ON `trust_badges` (`BadgeKey`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    CREATE INDEX `IX_trust_badges_IsEnabled_DisplayOrder` ON `trust_badges` (`IsEnabled`, `DisplayOrder`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919045627_ScmehaSchemaReconciliation') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260919045627_ScmehaSchemaReconciliation', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    CREATE TABLE `assistant_chat_sessions` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SessionKey` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
        `VisitorReference` varchar(160) CHARACTER SET utf8mb4 NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_assistant_chat_sessions` PRIMARY KEY (`Id`)
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    CREATE TABLE `assistant_chat_messages` (
        `Id` char(36) COLLATE ascii_general_ci NOT NULL,
        `SessionId` char(36) COLLATE ascii_general_ci NOT NULL,
        `Role` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
        `Content` longtext CHARACTER SET utf8mb4 NOT NULL,
        `CreatedAt` datetime(6) NOT NULL,
        `UpdatedAt` datetime(6) NOT NULL,
        CONSTRAINT `PK_assistant_chat_messages` PRIMARY KEY (`Id`),
        CONSTRAINT `FK_assistant_chat_messages_assistant_chat_sessions_SessionId` FOREIGN KEY (`SessionId`) REFERENCES `assistant_chat_sessions` (`Id`) ON DELETE CASCADE
    ) CHARACTER SET=utf8mb4;

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    CREATE INDEX `IX_assistant_chat_messages_SessionId_CreatedAt` ON `assistant_chat_messages` (`SessionId`, `CreatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    CREATE UNIQUE INDEX `IX_assistant_chat_sessions_SessionKey` ON `assistant_chat_sessions` (`SessionKey`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    CREATE INDEX `IX_assistant_chat_sessions_UpdatedAt` ON `assistant_chat_sessions` (`UpdatedAt`);

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

DROP PROCEDURE IF EXISTS MigrationsScript;
DELIMITER //
CREATE PROCEDURE MigrationsScript()
BEGIN
    IF NOT EXISTS(SELECT 1 FROM `__EFMigrationsHistory` WHERE `MigrationId` = '20260919053924_AssistantChatSessions') THEN

    INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
    VALUES ('20260919053924_AssistantChatSessions', '9.0.0');

    END IF;
END //
DELIMITER ;
CALL MigrationsScript();
DROP PROCEDURE MigrationsScript;

COMMIT;

