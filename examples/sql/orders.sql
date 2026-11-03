CREATE TABLE orders (
  order_id   INTEGER PRIMARY KEY,
  member_id  INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity   INTEGER NOT NULL,
  order_date DATE    NOT NULL,
  FOREIGN KEY (member_id)  REFERENCES members (member_id),
  FOREIGN KEY (product_id) REFERENCES products (product_id)
);
INSERT INTO orders VALUES
  (1001, 1, 101, 2, '2026-10-01'),
  (1002, 2, 103, 5, '2026-10-01'),
  (1003, 1, 102, 1, '2026-10-02'),
  (1004, 3, 101, 1, '2026-10-03');
