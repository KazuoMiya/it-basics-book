CREATE TABLE accounts (
  account_id VARCHAR(10) PRIMARY KEY,
  holder     VARCHAR(20) NOT NULL,
  balance    INTEGER     NOT NULL
);
INSERT INTO accounts VALUES
  ('A', 'Aさん', 50000),
  ('B', 'Bさん', 30000);
