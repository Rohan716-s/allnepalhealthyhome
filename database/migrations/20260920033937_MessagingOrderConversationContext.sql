START TRANSACTION;
ALTER TABLE `message_conversations` ADD `OrderId` char(36) COLLATE ascii_general_ci NULL;

CREATE UNIQUE INDEX `IX_message_conversations_OrderId` ON `message_conversations` (`OrderId`);

ALTER TABLE `message_conversations` ADD CONSTRAINT `FK_message_conversations_pharmacy_orders_OrderId` FOREIGN KEY (`OrderId`) REFERENCES `pharmacy_orders` (`Id`) ON DELETE SET NULL;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260920033937_MessagingOrderConversationContext', '9.0.0');

COMMIT;

