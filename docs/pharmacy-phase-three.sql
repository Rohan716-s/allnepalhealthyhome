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

COMMIT;

