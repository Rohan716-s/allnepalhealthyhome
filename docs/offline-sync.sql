-- Additive installation for existing databases. Do not drop existing tables.
CREATE TABLE IF NOT EXISTS offline_sync_receipts (
          Owner varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          OperationId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          RequestHash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          StatusCode int NOT NULL,
          ResponseBody longtext CHARACTER SET utf8mb4 NOT NULL,
          CreatedAt datetime(6) NOT NULL,
          PRIMARY KEY (Owner, OperationId)
        ) ENGINE=InnoDB;
