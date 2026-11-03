# ITのしくみ入門（仮題）

コンピューター、データ、プログラム、データベース、ネットワーク、セキュリティのしくみを、「なぜそうなるのか」「実際にはどう動いているのか」から学ぶIT入門書の原稿です。

Web版: https://kazuomiya.github.io/it-basics-book/

Web版では、本文中のPythonとSQLのコード例をその場で実行・編集できます。Pythonはブラウザーの中で動くPython 3.12（Pyodide）、SQLはブラウザーの中で動くSQLite（sql.js）で実行します。サーバーにコードを送ることはありません。

## 構成

| 章 | ファイル |
| --- | --- |
| 序論　画面の向こう側をのぞいてみよう | [manuscript/00-intro.md](manuscript/00-intro.md) |
| 第1章　部品の役割分担を見抜く | [manuscript/01-computer.md](manuscript/01-computer.md) |
| 第2章　あらゆる情報を0と1に置き換える | [manuscript/02-data.md](manuscript/02-data.md) |
| 第3章　書いたコードが動き出すまでを追う | [manuscript/03-program.md](manuscript/03-program.md) |
| 第4章　データを整え、すばやく探し出す | [manuscript/04-data-structures.md](manuscript/04-data-structures.md) |
| 第5章　大量のデータを速く正しく管理する | [manuscript/05-database.md](manuscript/05-database.md) |
| 第6章　メッセージが世界を旅する道のりをたどる | [manuscript/06-network.md](manuscript/06-network.md) |
| 第7章　攻撃の手口を知り、守りを固める | [manuscript/07-security.md](manuscript/07-security.md) |
| おわりに | [manuscript/08-outro.md](manuscript/08-outro.md) |

```
manuscript/      原稿（章ごとのMarkdown。これが正本）
figures/         図（SVG）。figures/src/ は図の元になったコード
examples/sql/    SQLのコード例で使うサンプルテーブル
site/            Web版の見た目と動き（CSS・JavaScript）
tools/           ビルドとコード例の確認に使うスクリプト
book.json        書名、リポジトリ、読み込むライブラリの設定
```

## 原稿の書き方

- 章のファイルは、1行目を `# 第N章　タイトル` にします。節は `## N-M　タイトル`、項は `###` です。
- 図は `![図N-M　キャプション](../figures/fig-N-M.svg)` の1行で入れます。
- 表のキャプションは、表の直前の段落に `表N-M　タイトル` と書きます。
- ` ```python ` と ` ```sql ` のコードは、Web版で実行ボタン付きになります。直後に置いた実行結果（Pythonは ` ``` ` のブロック、SQLは表）は「本書に掲載の結果」として表示されます。
- コードブロックには、言語名の後ろにオプションを書けます。

| 書き方 | 意味 |
| --- | --- |
| ` ```python id=photos ` | このコードに名前を付ける |
| ` ```python uses=photos ` | 名前を付けたコードを先に（表示せずに）実行してから、このコードを実行する |
| ` ```sql tables=members,products ` | 用意するサンプルテーブルを指定する（省略時はすべて） |
| ` ```python norun ` | 実行ボタンを付けない |

## 手元でビルドする

Python 3.12 を使います。

```sh
pip install markdown-it-py
python tools/check_examples.py   # コード例が本の結果どおりに動くか確かめる
python tools/build.py            # _site/ にWeb版を作る
python -m http.server -d _site   # http://localhost:8000/ で確認する
```

`main` ブランチに push すると、GitHub Actions がコード例を確かめてからWeb版を組み立て、GitHub Pages に公開します。

## 図を作り直すとき

図は `figures/src/*.jsx`（ReactのJSXで書いたSVG）から作っています。作り直すには Node.js と react・react-dom・typescript が必要です。

```sh
node tools/render_figs.js
```

## ライセンス

未定です。現時点では、原稿・図・コードの著作権はすべて著者に帰属します。
