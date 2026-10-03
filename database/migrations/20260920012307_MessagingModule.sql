START TRANSACTION;
CREATE TABLE `message_conversations` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Subject` varchar(200) CHARACTER SET utf8mb4 NULL,
    `IsClosed` tinyint(1) NOT NULL,
    `LastMessageAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_message_conversations` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `messaging_role_settings` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Role` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    `IsEnabled` tinyint(1) NOT NULL,
    `UpdatedByStaffUserId` char(36) COLLATE ascii_general_ci NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_messaging_role_settings` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_messaging_role_settings_staff_users_UpdatedByStaffUserId` FOREIGN KEY (`UpdatedByStaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL
) CHARACTER SET=utf8mb4;

CREATE TABLE `message_participants` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ConversationId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CustomerId` char(36) COLLATE ascii_general_ci NULL,
    `StaffUserId` char(36) COLLATE ascii_general_ci NULL,
    `ParticipantRole` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    `LastReadAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_message_participants` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_message_participants_customers_CustomerId` FOREIGN KEY (`CustomerId`) REFERENCES `customers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_message_participants_message_conversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `message_conversations` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_message_participants_staff_users_StaffUserId` FOREIGN KEY (`StaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `platform_messages` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ConversationId` char(36) COLLATE ascii_general_ci NOT NULL,
    `SenderCustomerId` char(36) COLLATE ascii_general_ci NULL,
    `SenderStaffUserId` char(36) COLLATE ascii_general_ci NULL,
    `Body` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `DeliveredAt` datetime(6) NULL,
    `SeenAt` datetime(6) NULL,
    `Latitude` decimal(10,7) NULL,
    `Longitude` decimal(10,7) NULL,
    `LocationLabel` varchar(300) CHARACTER SET utf8mb4 NULL,
    `LocationSource` varchar(30) CHARACTER SET utf8mb4 NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_platform_messages` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_platform_messages_customers_SenderCustomerId` FOREIGN KEY (`SenderCustomerId`) REFERENCES `customers` (`Id`) ON DELETE SET NULL,
    CONSTRAINT `FK_platform_messages_message_conversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `message_conversations` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_platform_messages_staff_users_SenderStaffUserId` FOREIGN KEY (`SenderStaffUserId`) REFERENCES `staff_users` (`Id`) ON DELETE SET NULL
) CHARACTER SET=utf8mb4;

CREATE TABLE `message_attachments` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `MessageId` char(36) COLLATE ascii_general_ci NOT NULL,
    `OriginalFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `StoredFileName` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ContentType` varchar(160) CHARACTER SET utf8mb4 NOT NULL,
    `Length` bigint NOT NULL,
    `Sha256` varchar(64) CHARACTER SET utf8mb4 NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_message_attachments` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_message_attachments_platform_messages_MessageId` FOREIGN KEY (`MessageId`) REFERENCES `platform_messages` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_message_attachments_MessageId` ON `message_attachments` (`MessageId`);

CREATE UNIQUE INDEX `IX_message_attachments_StoredFileName` ON `message_attachments` (`StoredFileName`);

CREATE INDEX `IX_message_conversations_LastMessageAt` ON `message_conversations` (`LastMessageAt`);

CREATE INDEX `IX_message_participants_ConversationId` ON `message_participants` (`ConversationId`);

CREATE INDEX `IX_message_participants_CustomerId_ConversationId` ON `message_participants` (`CustomerId`, `ConversationId`);

CREATE INDEX `IX_message_participants_StaffUserId_ConversationId` ON `message_participants` (`StaffUserId`, `ConversationId`);

CREATE UNIQUE INDEX `IX_messaging_role_settings_Role` ON `messaging_role_settings` (`Role`);

CREATE INDEX `IX_messaging_role_settings_UpdatedByStaffUserId` ON `messaging_role_settings` (`UpdatedByStaffUserId`);

CREATE INDEX `IX_platform_messages_ConversationId_CreatedAt` ON `platform_messages` (`ConversationId`, `CreatedAt`);

CREATE INDEX `IX_platform_messages_SenderCustomerId` ON `platform_messages` (`SenderCustomerId`);

CREATE INDEX `IX_platform_messages_SenderStaffUserId` ON `platform_messages` (`SenderStaffUserId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260920012307_MessagingModule', '9.0.0');

COMMIT;

