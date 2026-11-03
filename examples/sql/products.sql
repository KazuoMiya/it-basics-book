CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  price      INTEGER     NOT NULL
);
INSERT INTO products VALUES
  (101, 'マグカップ', 1200),
  (102, 'トートバッグ', 2500),
  (103, 'ノート', 400);
