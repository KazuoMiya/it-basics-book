CREATE TABLE members (
  member_id  INTEGER PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL,
  prefecture VARCHAR(10)  NOT NULL,
  email      VARCHAR(100)
);
INSERT INTO members VALUES
  (1, '佐藤 花子', '東京都', 'hanako@example.com'),
  (2, '鈴木 一郎', '大阪府', 'ichiro@example.com'),
  (3, '高橋 美咲', '東京都', 'misaki@example.com');
