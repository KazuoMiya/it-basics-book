CREATE TABLE accounts (
  account_id VARCHAR(10) PRIMARY KEY NOT NULL,
  holder     VARCHAR(20) NOT NULL,
  balance    INTEGER     NOT NULL CHECK (balance >= 0)
);
INSERT INTO accounts VALUES
  ('A', 'Aさん', 50000),
  ('B', 'Bさん', 30000);
